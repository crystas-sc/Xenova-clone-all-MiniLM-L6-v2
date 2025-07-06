function quickSort(arr) {
    if (arr.length < 2) return arr;
    const pivot = arr[0];
    const left = arr.slice(1).filter(x => x < pivot);
    const right = arr.slice(1).filter(x => x >= pivot);
    return [...quickSort(left), pivot, ...quickSort(right)];
}

// Example usage:
// console.log(quickSort([3,6,8,10,1,2,1])); // [1,1,2,3,6,8,10]
