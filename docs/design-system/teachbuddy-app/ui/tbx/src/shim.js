// JSX factory for the overlay. React itself lives inside the app bundle and is
// reached through the bridge at render time, so both share one React instance.
export function h(type, props, ...children) {
  return globalThis.__tb.React.createElement(type, props, ...children);
}
export function Fragment(props) {
  return props.children ?? null;
}
