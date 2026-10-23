package backend

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestListDirListsTheOpenWorkspace(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "src"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "README.md"), []byte("readme"), 0o644); err != nil {
		t.Fatal(err)
	}
	runtime := New()
	if _, err := runtime.OpenWorkspace(context.Background(), root); err != nil {
		t.Fatal(err)
	}
	defer runtime.Close()

	listing, err := runtime.ListDir(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	byName := map[string]DirEntry{}
	for _, entry := range listing.Entries {
		byName[entry.Name] = entry
	}
	if byName["src"].Kind != "dir" || byName["README.md"].Kind != "file" {
		t.Fatalf("listing=%#v", listing)
	}
	if _, err := runtime.ListDir(context.Background(), ".."); err == nil {
		t.Fatal("a listing outside the workspace should be refused")
	}
	if runtime.WorkspacePath() != root {
		t.Fatalf("workspace=%q want %q", runtime.WorkspacePath(), root)
	}
}

func TestListDirWithoutAWorkspace(t *testing.T) {
	runtime := New()
	if _, err := runtime.ListDir(context.Background(), ""); err != ErrNoWorkspace {
		t.Fatalf("err=%v", err)
	}
	if _, err := runtime.SessionListDir(context.Background(), "s1", ""); err != ErrNoWorkspace {
		t.Fatalf("err=%v", err)
	}
}

func TestRevealInFinderConfinesToTheListing(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "src"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "src", "main.go"), nil, 0o644); err != nil {
		t.Fatal(err)
	}
	runtime := New()
	if _, err := runtime.OpenWorkspace(context.Background(), root); err != nil {
		t.Fatal(err)
	}
	defer runtime.Close()

	original := openInFinder
	defer func() { openInFinder = original }()
	var revealed []string
	var asReveal []bool
	openInFinder = func(_ context.Context, path string, reveal bool) error {
		revealed = append(revealed, path)
		asReveal = append(asReveal, reveal)
		return nil
	}

	if err := runtime.RevealInFinder(context.Background(), "src/main.go"); err != nil {
		t.Fatal(err)
	}
	if err := runtime.RevealInFinder(context.Background(), ""); err != nil {
		t.Fatal(err)
	}
	if len(revealed) != 2 || revealed[0] != filepath.Join(root, "src", "main.go") || !asReveal[0] {
		t.Fatalf("revealed=%v asReveal=%v", revealed, asReveal)
	}
	if revealed[1] != root || asReveal[1] {
		t.Fatalf("root reveal=%v", revealed[1])
	}

	for _, path := range []string{"../secret", "/etc/passwd", "src/missing.go", "missing/main.go"} {
		if err := runtime.RevealInFinder(context.Background(), path); err == nil {
			t.Fatalf("revealing %q should be refused", path)
		}
	}
	if len(revealed) != 2 {
		t.Fatalf("a refused path reached the Finder: %v", revealed)
	}
}
