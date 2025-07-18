import path from 'path';
import fs from 'fs';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import express from 'express';

export default (_, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    target: 'web',
    entry: {
      contextMenu: './src/contextMenu.ts',
      panelLoader: './src/panelLoader.ts',
      settingsLoader: './src/settingsLoader.ts',
      witHierarchyViewerLoader: './src/witHierarchyViewerLoader.ts',
    },
    output: {
      filename: '[name].js',
      path: path.resolve(process.cwd(), 'dist'),
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss'],
      modules: [path.resolve(process.cwd(), 'src'), 'node_modules'],
      alias: {
        'azure-devops-extension-sdk': path.resolve('node_modules/azure-devops-extension-sdk'),
      },
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true, // Faster builds, type checking handled by tsc
            },
          },
        },
        {
          test: /\.s?css$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: { importLoaders: 1, sourceMap: !isProduction },
            },
            {
              loader: 'sass-loader',
              options: { sourceMap: !isProduction },
            },
          ],
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset',
        },
        {
          test: /\.(woff|woff2|ttf|eot)$/,
          type: 'asset/resource',
          generator: {
            filename: 'static/fonts/[hash][ext][query]',
          },
        },
      ],
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          { from: '**/*.html', to: '[name][ext]', context: 'src' },
          { from: 'images', to: 'images' },
        ],
      }),
    ],
    devtool: isProduction ? 'source-map' : 'inline-source-map',
    performance: {
      hints: isProduction ? 'warning' : false,
    },
    ...(isProduction
      ? {}
      : {
          devServer: {
            static: {
              directory: path.resolve(process.cwd()),
            },
            client: {
              overlay: false, // Disable overlay for errors in Firefox for dev purposes
            },
            server: {
              type: 'https',
              options: {
                key: fs.readFileSync(path.resolve(process.cwd(), 'localhost-key.pem')),
                cert: fs.readFileSync(path.resolve(process.cwd(), 'localhost.pem')),
              },
            },
            open: false,
            hot: true,
            port: 3000,
            historyApiFallback: true,
            setupMiddlewares: (middlewares, devServer) => {
              if (!devServer || !devServer.app) {
                throw new Error('webpack-dev-server is not defined');
              }
              const imagesPath = path.resolve(process.cwd(), 'dist/images');
              devServer.app.use('/dist/images', express.static(imagesPath)); // Workaround for serving images from dist folder because of a problem with webpack-dev-server

              return middlewares;
            },
          },
        }),
  };
};
