import path from 'path';
import CopyWebpackPlugin from 'copy-webpack-plugin';

export default (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    target: 'web',
    entry: {
      "decomposeContextMenu": "./src/decomposeContextMenu.tsx" // BUG: Error: Aborted because ./src/decomposeContextMenu.tsx is not accepted. Update propagation: ./src/decomposeContextMenu.tsx
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
      ],
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          { from: '**/*.html', to: '[name][ext]', context: 'src' },
        ],
      })
    ],
    devtool: isProduction ? 'source-map' : 'inline-source-map',
    performance: {
      hints: isProduction ? 'warning' : false
    },
    devServer: {
      static: [
        {
          directory: path.resolve(process.cwd(), 'dist'),
        },
        {
          directory: path.resolve(process.cwd(), 'marketplace'),
          publicPath: '/marketplace',
        }
      ],
      server: 'https',
      open: true,
      hot: true,
      port: 3000,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
      }
    },
  };
};
