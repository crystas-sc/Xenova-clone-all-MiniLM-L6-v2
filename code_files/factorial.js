function factorial(n) {
    if (n < 0) return undefined;
    if (n === 0) return 1;
    return n * factorial(n - 1);
}

// Example usage:
// console.log(factorial(5)); // 120
