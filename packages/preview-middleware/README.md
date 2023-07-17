#  `@sap-ux/preview-middleware`

The `@sap-ux/preview-middleware` is a [Custom UI5 Server Middleware](https://sap.github.io/ui5-tooling/pages/extensibility/CustomServerMiddleware) for previewing an application in a local Fiori launchpad . It can be used either with the `ui5 serve` or the `fiori run` commands.

## Configuration Options
| Option       | Type  | Default Value | Description |
| ------------ | ------| ------------- | ----------- |
| `flp`        |           |                  |Optional configuration object for the local Fiori launchpad |
| `flp.path`   | `string`  | `/test/flp.html` | The mount point of the local Fiori launchpad. |
| `flp.apps`   | `array`   | `[]`          | Optional additional local apps that are available in local Fiori launchpad |
| `debug`      | `boolean` | false         | Enables debug output |

### `flp.apps`
Array of additional application configurations:
| Option       | Type  | Default Value | Description |
| ------------ | ------| ------------- | ----------- |
| `target`        | `string` |  | Target path of the additional application |
| `local`         | `string` |  | Local path to the folder containing the application |
| `intent`        |          |  | Optional intent to be used for the application |
| `intent.object` | `string` | `(calculated)`| Optional intent object, if it is not provided then it will be calculated based on the application id |
| `intent.action` | `string` | `preview` | Optional intent action |

## Usage
The middleware can be used without configuration. However, since the middleware intercepts a few requests that might otherwise be handled by a different middleware, it is strongly recommended to run other file serving middlewares after the `preview-middleware` e.g. `backend-proxy-middleware` and `ui5-proxy-middleware` (and the corresponding middlewares in the `@sap/ux-ui5-tooling`).
Example: [./test/fixtures/simple-app/ui5.yaml](./test/fixtures/simple-app/ui5.yaml) 

### Minimal Configuration
With no configuration provided, the app will be local FLP will be available at `/test/flp.html` and the log level is `info`.
```Yaml
server:
  customMiddleware:
  - name: preview-middleware
    afterMiddleware: compression
```

### Different Path and Debugging enabled
With this configuration, the app will be local FLP will be available at `/preview.html` and the log level is `debug`.
```Yaml
server:
  customMiddleware:
  - name: preview-middleware
    afterMiddleware: compression
    configuration:
      flp: 
        path: /preview.html
      debug: true
```

### Additional Applications
If you want to test cross application navigation, then you can add additional applications into the local FLP.
With this configuration, an application that is locally available in `../local-folder` will be available at `/apps/other-app` and will also be added as tile to the local FLP.
```Yaml
server:
  customMiddleware:
  - name: preview-middleware
    afterMiddleware: compression
    configuration:
      apps:
        - local: ../local-folder
          target: /apps/other-app
```