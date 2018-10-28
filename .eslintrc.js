module.exports = {
  extends: 'airbnb-base',
  settings: {
    'import/resolver': {
      node: {
        paths: ['src'],
      },
    },
  },
  rules: {
    'implicit-arrow-linebreak': 0,
  },
};
