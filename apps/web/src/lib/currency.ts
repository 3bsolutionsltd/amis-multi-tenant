/**
 * Currency formatting utility for AMIS
 * All monetary values in the application use Uganda Shillings (UGX)
 */

/**
 * Format an amount as Uganda Shillings with proper thousand separators
 * @param amount - The numeric amount to format
 * @param options - Optional formatting options
 * @returns Formatted currency string like "UGX 1,234,567" or "UGX 1,234.50"
 * 
 * @example
 * formatCurrency(1234567) // "UGX 1,234,567"
 * formatCurrency(1234.5, { decimals: 2 }) // "UGX 1,234.50"
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  options?: { decimals?: number }
): string {
  if (amount == null || amount === "") return "UGX 0";
  
  const numAmount = typeof amount === "string" ? Number(amount) : amount;
  
  if (isNaN(numAmount)) return "UGX 0";
  
  const formatted = options?.decimals !== undefined
    ? numAmount.toLocaleString("en-UG", {
        minimumFractionDigits: options.decimals,
        maximumFractionDigits: options.decimals,
      })
    : numAmount.toLocaleString("en-UG");
  
  return `UGX ${formatted}`;
}

/**
 * Format an amount as Uganda Shillings without the currency symbol
 * Useful for input fields or when the currency is already indicated
 */
export function formatAmount(
  amount: number | string | null | undefined,
  options?: { decimals?: number }
): string {
  if (amount == null || amount === "") return "0";
  
  const numAmount = typeof amount === "string" ? Number(amount) : amount;
  
  if (isNaN(numAmount)) return "0";
  
  return options?.decimals !== undefined
    ? numAmount.toLocaleString("en-UG", {
        minimumFractionDigits: options.decimals,
        maximumFractionDigits: options.decimals,
      })
    : numAmount.toLocaleString("en-UG");
}
