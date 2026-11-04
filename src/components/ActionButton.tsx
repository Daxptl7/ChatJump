export function ActionButton(): React.JSX.Element {
  return <><button type="button" className="primary-button w-full" disabled aria-describedby="search-availability">Search Messages</button><p id="search-availability" className="text-xs leading-5 text-muted">Date search is not available yet. It will be enabled after live message navigation is validated.</p></>;
}
