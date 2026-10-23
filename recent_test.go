package main

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestMissingDirectoriesReportsGoneAndNonDirectoryPaths(t *testing.T) {
	root := t.TempDir()
	present := filepath.Join(root, "present")
	if err := os.Mkdir(present, 0o755); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(root, "file.txt")
	if err := os.WriteFile(file, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	gone := filepath.Join(root, "gone")
	link := filepath.Join(root, "link")
	if err := os.Symlink(present, link); err != nil {
		t.Fatal(err)
	}
	dangling := filepath.Join(root, "dangling")
	if err := os.Symlink(gone, dangling); err != nil {
		t.Fatal(err)
	}

	got := missingDirectories([]string{present, file, gone, link, dangling, ""})
	want := []string{file, gone, dangling}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("missingDirectories = %v, want %v", got, want)
	}
	if got := missingDirectories(nil); got == nil || len(got) != 0 {
		t.Fatalf("no paths must give an empty, non-nil list (JSON []), got %#v", got)
	}
}
