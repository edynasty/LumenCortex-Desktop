package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"runtime/debug"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

// appVersion is the Desktop application version. wails.json `info.productVersion` is the single
// source of truth: scripts/build-macos.sh reads it and passes it here with
// -ldflags "-X main.appVersion=<version>", and Wails writes the same value into the bundle's
// Info.plist. The fallback is what `go run` and `go test` see.
var appVersion = "0.0.0-dev"

// appCommit is the source commit, injected by the build scripts with
// -ldflags "-X main.appCommit=<sha>". Without it the binary reports the Go VCS stamp, if any.
var appCommit = ""

// appBuiltAt is when the build ran, in UTC RFC 3339, injected by scripts/build-macos.sh with
// -ldflags "-X main.appBuiltAt=<time>". Empty in `go run` and `go test` builds.
var appBuiltAt = ""

const coreModulePath = "github.com/edynasty/LumenCortex"

// buildInfo is the JSON `--version` prints: which app, from which commit, over which Core.
type buildInfo struct {
	App                string `json:"app"`
	AppVersion         string `json:"appVersion"`
	Commit             string `json:"commit"`
	CommitSource       string `json:"commitSource"`
	BuiltAt            string `json:"builtAt,omitempty"`
	CoreModule         string `json:"coreModule"`
	CoreVersion        string `json:"coreVersion"`
	CoreLocal          bool   `json:"coreLocal"`
	CoreLocalPath      string `json:"coreLocalPath,omitempty"`
	CoreRuntimeVersion string `json:"coreRuntimeVersion"`
	GoVersion          string `json:"goVersion"`
	GoOS               string `json:"goos"`
	GoArch             string `json:"goarch"`
}

// currentBuildInfo reports the versions compiled into this binary. The Core module version comes
// from the build's module graph, so a local `replace` is reported as such instead of pretending to
// be the pinned release.
func currentBuildInfo() buildInfo {
	info := buildInfo{
		App:                "LumenCortex Desktop",
		AppVersion:         appVersion,
		Commit:             appCommit,
		CommitSource:       "ldflags",
		BuiltAt:            appBuiltAt,
		CoreModule:         coreModulePath,
		CoreVersion:        "unknown",
		CoreRuntimeVersion: lcx.GoRuntimePreviewVersion,
		GoVersion:          runtime.Version(),
		GoOS:               runtime.GOOS,
		GoArch:             runtime.GOARCH,
	}
	bi, ok := debug.ReadBuildInfo()
	if !ok {
		if info.Commit == "" {
			info.Commit, info.CommitSource = "unknown", "unknown"
		}
		return info
	}
	for _, dep := range bi.Deps {
		if dep.Path != coreModulePath {
			continue
		}
		info.CoreVersion = dep.Version
		if dep.Replace != nil {
			info.CoreLocal = true
			info.CoreLocalPath = dep.Replace.Path
			if dep.Replace.Version != "" {
				info.CoreVersion = dep.Replace.Version
			}
		}
		break
	}
	if info.Commit == "" {
		for _, setting := range bi.Settings {
			if setting.Key == "vcs.revision" {
				info.Commit, info.CommitSource = setting.Value, "vcs"
			}
		}
	}
	if info.Commit == "" {
		info.Commit, info.CommitSource = "unknown", "unknown"
	}
	return info
}

// aboutMessage is the macOS About box text. It names the same versions `--version` prints so a
// user reporting a problem can read them without a terminal.
func aboutMessage() string {
	info := currentBuildInfo()
	core := info.CoreVersion
	if info.CoreLocal {
		core += " (local build)"
	}
	return fmt.Sprintf(
		"LumenCortex Desktop %s\n本地优先的编码智能体工作区 · Local-first coding-agent workspace\nCore %s · runtime %s · %s",
		info.AppVersion, core, info.CoreRuntimeVersion, info.GoVersion,
	)
}

// handleDiagnosticArgs serves `--version` and `--self-check` before Wails starts, so neither opens
// a window. It reports whether it handled the invocation and the process exit code. Unknown
// arguments are ignored: Finder passes arguments such as -psn_… to the app.
func handleDiagnosticArgs(args []string, stdout, stderr io.Writer) (handled bool, code int) {
	for _, arg := range args {
		switch arg {
		case "--version", "-version":
			encoder := json.NewEncoder(stdout)
			encoder.SetIndent("", "  ")
			if err := encoder.Encode(currentBuildInfo()); err != nil {
				fmt.Fprintf(stderr, "print version: %v\n", err)
				return true, 1
			}
			return true, 0
		case "--self-check", "-self-check":
			if err := runSelfCheck(stdout); err != nil {
				fmt.Fprintf(stderr, "self-check failed: %v\n", err)
				return true, 1
			}
			return true, 0
		}
	}
	return false, 0
}

// selfCheckResult is what `--self-check` prints: the build identity plus the health of an Engine
// opened over a throwaway workspace.
type selfCheckResult struct {
	OK      bool        `json:"ok"`
	Error   string      `json:"error,omitempty"`
	Version buildInfo   `json:"version"`
	Engine  *lcx.Health `json:"engine,omitempty"`
}

// runSelfCheck opens and closes a Core Engine over a fresh temporary workspace. Core's Options
// carry the state directory (RepoDir), and HOME/XDG_CONFIG_HOME are pointed at the temporary root
// so the check neither reads the user's global configuration nor writes outside the temp tree.
func runSelfCheck(stdout io.Writer) error {
	root, err := os.MkdirTemp("", "lcx-self-check-")
	if err != nil {
		return fmt.Errorf("create temp root: %w", err)
	}
	defer os.RemoveAll(root)
	workspace := filepath.Join(root, "workspace")
	state := filepath.Join(root, "state")
	home := filepath.Join(root, "home")
	configHome := filepath.Join(home, ".config")
	for _, dir := range []string{workspace, state, configHome} {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return fmt.Errorf("create %s: %w", dir, err)
		}
	}
	_ = os.Setenv("HOME", home)
	_ = os.Setenv("XDG_CONFIG_HOME", configHome)

	result := selfCheckResult{Version: currentBuildInfo()}
	engine, err := lcx.Open(lcx.Options{Workspace: workspace, RepoDir: state})
	if err != nil {
		return reportSelfCheck(stdout, result, fmt.Errorf("open engine: %w", err))
	}
	health := engine.Health()
	closeErr := engine.Close()
	if closeErr != nil {
		return reportSelfCheck(stdout, result, fmt.Errorf("close engine: %w", closeErr))
	}
	result.OK = true
	result.Engine = &health
	return reportSelfCheck(stdout, result, nil)
}

// reportSelfCheck prints the result as one JSON object and returns err so the caller can exit
// non-zero. A failed check still prints a parseable object.
func reportSelfCheck(stdout io.Writer, result selfCheckResult, err error) error {
	if err != nil {
		result.Error = err.Error()
	}
	encoder := json.NewEncoder(stdout)
	encoder.SetIndent("", "  ")
	if encodeErr := encoder.Encode(result); encodeErr != nil {
		return encodeErr
	}
	return err
}
