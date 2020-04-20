module.exports = {
  roots: ["<rootDir>/test"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  testRegex: "test\\/.*\\.test\\.ts$",
  moduleFileExtensions: ["ts", "js", "json", "node"],
  setupFilesAfterEnv: [],
  testEnvironment: "node",
};
