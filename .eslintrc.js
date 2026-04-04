module.exports = {
  "env": {
    "browser": true,
    "es2021": true,
    "webextensions": true
  },
  "extends": "eslint:recommended",
  "overrides": [
    {
      "env": {
        "node": true
      },
      "files": [
        ".eslintrc.{js,cjs}"
      ],
      "parserOptions": {
        "sourceType": "script"
      }
    }
  ],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "globals": {
    "cloneInto": "readonly",
    "marked": "readonly",
    "DOMPurify": "readonly",
    "Prism": "readonly",
    "ace": "readonly",
    "culori": "readonly",
    "poline": "readonly",
    "nobleEd25519": "readonly",
    "$": "readonly"
  },
  "rules": {
    "no-case-declarations": "off",
    "no-unused-vars": "off",
    "no-useless-escape": "off"
  }
}
