# LumenCortex Desktop

A lightweight desktop workspace for LumenCortex.

The desktop client is designed around the same bounded-memory runtime as LumenCortex: Session history stays durable, tool output streams instead of accumulating unbounded buffers, and the UI consumes bounded event windows.

## Status

Early implementation. The first milestone targets macOS with Wails + Go + React, while keeping the UI/runtime boundary portable to Windows and Linux.
