export interface Bank { code: string; name: string }

// Demo list using Paystack bank codes; replace with Paystack GET /bank when the API is integrated.
export const nigerianBanks: Bank[] = [
  { code: '044', name: 'Access Bank' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '030', name: 'Heritage Bank' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '50211', name: 'Kuda Bank' },
  { code: '50515', name: 'Moniepoint MFB' },
  { code: '999992', name: 'OPay' },
  { code: '999991', name: 'PalmPay' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
]

export const isNuban = (value: string) => /^\d{10}$/.test(value)

export const maskAccount = (n: string) => n.length >= 4 ? `******${n.slice(-4)}` : n

/** Simulates a bank account lookup. No network call is made. */
export async function resolveAccountDemo(bankCode: string, accountNumber: string, holderName: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 500))
  if (!nigerianBanks.some(bank => bank.code === bankCode))
    throw new Error('Choose a bank from the list.')
  if (!isNuban(accountNumber))
    throw new Error('Enter a 10-digit account number.')
  if (accountNumber.endsWith('0000'))
    throw new Error('We could not verify this account. Check the number and bank.')

  return holderName.toUpperCase()
}

const genericWords = new Set(['LTD', 'LIMITED', 'ENTERPRISE', 'ENTERPRISES', 'SERVICES', 'SERVICE'])
const nameWords = (value: string) => value.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(word => word && !genericWords.has(word))

/** Loose match between a bank account name and a provider name: true when they share at least one word. */
export const accountNameMatches = (accountName: string, providerName: string) => {
  const expected = nameWords(providerName)
  const actual = new Set(nameWords(accountName))

  return !expected.length || expected.some(word => actual.has(word))
}
