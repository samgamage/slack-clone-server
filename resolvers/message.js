import { PubSub, withFilter } from 'graphql-yoga';
import jwt from 'jsonwebtoken';
import requiresAuth from '../permissions';
import { refreshTokens } from '../auth';

const pubsub = new PubSub();

const NEW_CHANNEL_MESSAGE = 'NEW_CHANNEL_MESSAGE';

export default {
  Subscription: {
    newChannelMessage: {
      subscribe: async (_, __, {
        connection, SECRET, SECRET2, models,
      }) => {
        const { token, refreshToken } = connection.context;
        if (token && refreshToken) {
          let user = null;
          try {
            const payload = jwt.verify(token, SECRET);
            // eslint-disable-next-line prefer-destructuring
            user = payload.user;
          } catch (err) {
            const newTokens = await refreshTokens(token, refreshToken, models, SECRET, SECRET2);
            // eslint-disable-next-line prefer-destructuring
            user = newTokens.user;
          }

          if (!user) {
            throw new Error('Invalid auth tokens');
          }

          const asyncIterator = pubsub.asyncIterator(NEW_CHANNEL_MESSAGE);
          withFilter(() => asyncIterator, (payload, args) => payload.channelId === args.channelId);
          return asyncIterator;
        }

        throw new Error('Missing auth tokens');
      },
    },
  },
  Message: {
    user: ({ user, userId }, args, ctx) => {
      if (user) {
        return user;
      }

      return ctx.models.User.findOne({ where: { id: userId } }, { raw: true });
    },
  },
  Query: {
    messages: requiresAuth.createResolver(async (parent, { channelId }, ctx) =>
      ctx.models.Message.findAll(
        { order: [['created_at', 'ASC']], where: { channelId } },
        { raw: true },
      )),
  },
  Mutation: {
    createMessage: requiresAuth.createResolver(async (parent, args, ctx) => {
      try {
        const message = await ctx.models.Message.create({
          ...args,
          userId: ctx.request.user.id,
        });

        const asyncFunc = async () => {
          const currentUser = await ctx.models.User.findOne({
            where: {
              id: ctx.request.user.id,
            },
          });

          pubsub.publish(NEW_CHANNEL_MESSAGE, {
            channelId: args.channelId,
            newChannelMessage: {
              ...message.dataValues,
              user: currentUser.dataValues,
            },
          });
        };

        asyncFunc();

        return true;
      } catch (err) {
        console.log(err);
        return false;
      }
    }),
  },
};
