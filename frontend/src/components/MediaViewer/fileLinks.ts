const links = new Map<string, string>()

export function getLinkId(path: string): string | undefined {
  return links.get(path)
}

export function setLinkId(path: string, id: string) {
  links.set(path, id)
}

export function updateLinkPath(oldPath: string, newPath: string) {
  const id = links.get(oldPath)
  if (id) {
    links.delete(oldPath)
    links.set(newPath, id)
  }
}
