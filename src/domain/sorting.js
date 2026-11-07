import { DomainError } from "./errors.js";

const defaultCompare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function mergeSort(items, compare = defaultCompare) {
  if (!Array.isArray(items)) {
    throw new DomainError("items must be an array", "VALIDATION");
  }
  if (typeof compare !== "function") {
    throw new DomainError("compare must be a function", "VALIDATION");
  }
  if (items.length <= 1) return [...items];

  const middle = Math.floor(items.length / 2);
  const left = mergeSort(items.slice(0, middle), compare);
  const right = mergeSort(items.slice(middle), compare);
  return merge(left, right, compare);
}

function merge(left, right, compare) {
  const merged = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (compare(left[leftIndex], right[rightIndex]) <= 0) {
      merged.push(left[leftIndex]);
      leftIndex += 1;
    } else {
      merged.push(right[rightIndex]);
      rightIndex += 1;
    }
  }

  while (leftIndex < left.length) merged.push(left[leftIndex++]);
  while (rightIndex < right.length) merged.push(right[rightIndex++]);
  return merged;
}
