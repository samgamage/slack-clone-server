import { fileLoader, mergeResolvers, mergeTypes } from 'merge-graphql-schemas';
import path from 'path';
import jwt from 'jsonwebtoken';
import { GraphQLServer } from 'graphql-yoga';
import { makeExecutableSchema } from 'graphql-tools';

import { refreshTokens } from './auth';
import models from './models';

const SECRET = 'asdmklmflkmlkm121kl23maks';
const SECRET2 = 'asdmklmflkmlkm121kl23maksasdasdlkm';

const typeDefs = mergeTypes(fileLoader(path.join(__dirname, './schema')));

const resolvers = mergeResolvers(fileLoader(path.join(__dirname, './resolvers')));

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const addUser = async (req, res, next) => {
  const token = req.headers['x-token'];
  if (token) {
    try {
      const { user } = jwt.verify(token, SECRET);
      req.user = user;
    } catch (err) {
      const refreshToken = req.headers['x-refresh-token'];
      const newTokens = await refreshTokens(token, refreshToken, models, SECRET, SECRET2);
      if (newTokens.token && newTokens.refreshToken) {
        res.set('Access-Control-Expose-Headers', 'x-token, x-refresh-token');
        res.set('x-token', newTokens.token);
        res.set('x-refresh-token', newTokens.refreshToken);
      }
      req.user = newTokens.user;
    }
  }
  next();
};

const context = (req, conn) => ({
  ...req,
  models,
  SECRET,
  SECRET2,
  ...conn,
});

const server = new GraphQLServer({
  schema,
  context,
});

server.express.use(addUser);

const options = {
  port: 8080,
  endpoint: '/graphql',
  subscriptions: '/subscriptions',
  playground: '/playground',
};

models.sequelize.sync().then(() => {
  server.start(options, ({ port }) =>
    console.log(
      `========================================\n🚀  Server is running on localhost:${port}\n========================================`,
    ));
});
