# workers

Purpose: Placeholder folder for browser-native Web Worker scripts used by CloudCanvas-TF.

Web Workers run off the main thread, outside Angular's zone and DI system. They handle CPU-intensive operations (Terraform AST generation, graph validation, topological sort) to keep the UI responsive. Angular services communicate with them via message-passing bridges defined in this folder.
