/** Jest stub for react-native-localize (Node test environment). */
const enUs = {
  countryCode: 'US',
  languageTag: 'en-US',
  languageCode: 'en',
  isRTL: false,
};

module.exports = {
  getLocales: () => [enUs],
  getNumberFormatSettings: () => ({
    decimalSeparator: '.',
    groupingSeparator: ',',
  }),
  getCalendar: () => 'gregorian',
  getCountry: () => 'US',
  getCurrencies: () => ['USD'],
  getTemperatureUnit: () => 'celsius',
  getTimeZone: () => 'America/New_York',
  uses24HourClock: () => false,
  usesMetricSystem: () => false,
  findBestLanguageTag: () => ({
    languageTag: 'en-US',
    isRTL: false,
  }),
};
