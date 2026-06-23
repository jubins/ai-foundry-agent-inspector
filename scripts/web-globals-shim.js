// Stubs for DOM globals checked by @azure/core-xml at module load time.
// VS Code Web extension host runs in a web worker which has no DOM — these
// four globals must exist or the SDK throws before activate() can run.
// The XML parsing code paths they guard are never reached by this extension.
if (typeof document === "undefined") {
  globalThis.document = {};
}
if (typeof DOMParser === "undefined") {
  globalThis.DOMParser = function () {};
}
if (typeof Node === "undefined") {
  globalThis.Node = {};
}
if (typeof XMLSerializer === "undefined") {
  globalThis.XMLSerializer = function () {};
}
