export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "textContent") node.textContent = String(value);
    else if (key === "className") node.className = String(value);
    else if (key === "children") continue;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "dataset" && typeof value === "object") {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        node.dataset[dataKey] = String(dataValue);
      }
    } else node.setAttribute(key, String(value));
  }
  const childList = props.children ?? children;
  for (const child of Array.isArray(childList) ? childList : [childList]) {
    if (typeof child === "string" || typeof child === "number") {
      node.append(document.createTextNode(String(child)));
    } else if (child instanceof Node) node.append(child);
  }
  return node;
}

export function formatPrice(priceCents) {
  const naira = Number(priceCents) / 100;
  const wholeNaira = new Intl.NumberFormat("en-NG", {
    style: "decimal",
    useGrouping: true,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(naira);
  return `₦${wholeNaira}`;
}
