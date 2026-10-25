export type ModelResult = {
  name: string;
  shortName: string;
  color: string;
  trainR2: number;
  testR2: number;
  trainRmse: number;
  testRmse: number;
  trainMae: number;
  testMae: number;
  cvR2Mean: number;
  cvR2Std: number;
  alpha?: number;
};

export const evaluationSummary = {
  trainingSamples: 1146,
  testSamples: 287,
  testSize: 0.2,
  randomState: 42,
  crossValidationFolds: 5,
  featureCount: 10,
  datasetSamples: 1433,
  datasetMean: 1561.08,
  datasetMedian: 1542.65,
  datasetStdDev: 606.82,
  bestModel: "Ridge Regression",
} as const;

export const modelResults: ModelResult[] = [
  {
    name: "Multiple Linear Regression",
    shortName: "Linear",
    color: "#73e7e0",
    trainR2: 0.319701,
    testR2: 0.369206,
    trainRmse: 497.291488,
    testRmse: 493.292108,
    trainMae: 364.6244,
    testMae: 373.562887,
    cvR2Mean: 0.30218,
    cvR2Std: 0.03436,
  },
  {
    name: "Lasso Regression",
    shortName: "Lasso",
    color: "#a8ffcb",
    trainR2: 0.318021,
    testR2: 0.368721,
    trainRmse: 497.905243,
    testRmse: 493.481436,
    trainMae: 365.005079,
    testMae: 374.986054,
    cvR2Mean: 0.306311,
    cvR2Std: 0.027296,
    alpha: 5.963623,
  },
  {
    name: "Ridge Regression",
    shortName: "Ridge",
    color: "#f5d78e",
    trainR2: 0.318898,
    testR2: 0.369452,
    trainRmse: 497.584705,
    testRmse: 493.195716,
    trainMae: 364.688286,
    testMae: 374.780477,
    cvR2Mean: 0.304925,
    cvR2Std: 0.02877,
    alpha: 51.794747,
  },
];

export const coefficientResults = [
  { feature: "PRCP", linear: -20.584186, lasso: -14.741712, ridge: -20.257493 },
  { feature: "TMAX", linear: -102.210264, lasso: 0, ridge: -100.771194 },
  { feature: "TMIN", linear: -117.53261, lasso: -84.504011, ridge: -115.235638 },
  { feature: "temp_range", linear: 9.439993, lasso: 0, ridge: 7.392187 },
  { feature: "temp_avg", linear: -110.659699, lasso: -234.596071, ridge: -108.795229 },
  { feature: "month", linear: 34.961977, lasso: 0, ridge: 39.051951 },
  { feature: "day_of_week", linear: -6.156273, lasso: 0, ridge: 3.483854 },
  { feature: "day_of_year", linear: 108.001645, lasso: 52.921576, ridge: 48.673906 },
  { feature: "quarter", linear: -84.92229, lasso: 0, ridge: -31.839164 },
  { feature: "is_weekend", linear: 127.5509, lasso: 116.954917, ridge: 115.075737 },
] as const;
