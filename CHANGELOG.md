# Changelog

## 0.0.1 (2026-11-16)

First implementation of `display-module`.

### Added

- `NanoModuleComponent` (`<nano-module>`): renders a `WorkSpaceNode` with its title, parameters, inputs and outputs.
- View, select and edit modes driven by `isSelectMode` and `isEditMode`, with the "Editing" badge, mode borders and z-index (4 by default, 5 when selected or editing).
- Two-way `workSpaceNode` model with immutable updates.
- Inline editing of the title and of port names, with trim, cancel on empty or unchanged text, Enter and Escape to leave, and a dashed underline on the title input.
- Save status (`savingStatus` signal and indicator): "Saving changes…" while typing, "Changes saved" after a successful save, with a 1000 ms debounce and the `success` handshake on `UpdateWorkSpaceEvent`.
- Adding and deleting ports, with unique generated ids and case-insensitive unique names across the node.
- Outputs `portMouseDown`, `portMouseUp`, `addPort`, `deletePort`, `onModuleUpdate`, `nodeClicked`, `nodeDoubleClicked` and `isEditing`.
- Drag isolation for form controls, port handles, editable text and `ignoreClasses` elements.
- Tooltips for view-mode hover and for editable text.
- Dark and light themes through the `dark` and `light` host classes, `--nano-module-*` custom properties, and the exported stylesheet `display-module/styles/display-module.css`.
- `provideDisplayModule({ assetPath })` and `DISPLAY_MODULE_CONFIG` for an alternate icon location; Base64 icons by default. Icon files ship in `display-module/assets/`.

### Verification status

The library builds and type-checks. The test suites have not been run against this implementation; that is done by the separate testing process.
