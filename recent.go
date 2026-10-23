package main

import "os"

// maxRecentPaths bounds one MissingDirectories call; the frontend keeps eight recent projects.
const maxRecentPaths = 32

// MissingDirectories reports which of the recent-project paths are no longer a directory, so the
// project menu can grey them out and offer removal instead of failing on open. The recent list is
// Desktop's own (local storage); nothing here opens, creates or changes a path.
func (a *App) MissingDirectories(paths []string) []string {
	return missingDirectories(paths)
}

func missingDirectories(paths []string) []string {
	if len(paths) > maxRecentPaths {
		paths = paths[:maxRecentPaths]
	}
	missing := []string{}
	for _, path := range paths {
		if path == "" {
			continue
		}
		info, err := os.Stat(path)
		if err != nil || !info.IsDir() {
			missing = append(missing, path)
		}
	}
	return missing
}
