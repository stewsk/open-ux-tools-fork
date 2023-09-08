import Log from 'sap/base/Log';
import type AppLifeCycle from 'sap/ushell/services/AppLifeCycle';
import IconPool from 'sap/ui/core/IconPool';
import ResourceBundle from 'sap/base/i18n/ResourceBundle';
import UriParameters from 'sap/base/util/UriParameters';

/**
 * SAPUI5 delivered namespaces from https://ui5.sap.com/#/api/sap
 */
const UI5_LIBS = [
    'sap.apf',
    'sap.base',
    'sap.chart',
    'sap.collaboration',
    'sap.f',
    'sap.fe',
    'sap.fileviewer',
    'sap.gantt',
    'sap.landvisz',
    'sap.m',
    'sap.ndc',
    'sap.ovp',
    'sap.rules',
    'sap.suite',
    'sap.tnt',
    'sap.ui',
    'sap.uiext',
    'sap.ushell',
    'sap.uxap',
    'sap.viz',
    'sap.webanalytics',
    'sap.zen'
];

/**
 * Check whether a specific dependency is a custom library, and if yes, add it to the map.
 *
 * @param dependency dependency from the manifest
 * @param customLibs map containing the required custom libraries
 */
function addKeys(dependency: Record<string, unknown>, customLibs: Record<string, true>): void {
    Object.keys(dependency).forEach(function (key) {
        // ignore libs or Components that start with SAPUI5 delivered namespaces
        if (
            !UI5_LIBS.some(function (substring) {
                return key === substring || key.startsWith(substring + '.');
            })
        ) {
            customLibs[key] = true;
        }
    });
}

/**
 * Fetch the manifest for all the given application urls and generate a string containing all required custom library ids.
 *
 * @param appUrls urls pointing to included applications
 * @returns Promise of a comma separated list of all required libraries.
 */
function getManifestLibs(appUrls: string[]): Promise<string> {
    const result = {} as Record<string, true>;
    const promises = [];
    for (const url of appUrls) {
        promises.push(
            fetch(`${url}/manifest.json`).then(async (resp) => {
                const manifest = await resp.json();
                if (manifest) {
                    if (manifest['sap.ui5'] && manifest['sap.ui5'].dependencies) {
                        if (manifest['sap.ui5'].dependencies.libs) {
                            addKeys(manifest['sap.ui5'].dependencies.libs, result);
                        }
                        if (manifest['sap.ui5'].dependencies.components) {
                            addKeys(manifest['sap.ui5'].dependencies.components, result);
                        }
                    }
                    if (manifest['sap.ui5'] && manifest['sap.ui5'].componentUsages) {
                        addKeys(manifest['sap.ui5'].componentUsages, result);
                    }
                }
            })
        );
    }
    return Promise.all(promises).then(() => Object.keys(result).join(','));
}

/**
 * Register the custom libraries and their url with the UI5 loader.
 *
 * @param dataFromAppIndex data returned from the app index service
 */
function registerModules(
    dataFromAppIndex: Record<
        string,
        {
            dependencies?: {
                url?: string;
                type?: string;
                componentId: string;
            }[];
        }
    >
) {
    Object.keys(dataFromAppIndex).forEach(function (moduleDefinitionKey) {
        const moduleDefinition = dataFromAppIndex[moduleDefinitionKey];
        if (moduleDefinition && moduleDefinition.dependencies) {
            moduleDefinition.dependencies.forEach(function (dependency) {
                if (dependency.url && dependency.url.length > 0 && dependency.type === 'UI5LIB') {
                    Log.info('Registering Library ' + dependency.componentId + ' from server ' + dependency.url);
                    const compId = dependency.componentId.replace(/\./g, '/');
                    const config = {
                        paths: {} as Record<string, string>
                    };
                    config.paths[compId] = dependency.url;
                    sap.ui.loader.config(config);
                }
            });
        }
    });
}

/**
 * Fetch the manifest from the given application urls, then parse them for custom libs, and finally request their urls.
 *
 * @param appUrls application urls
 * @returns returns a promise when the registration is completed.
 */
export async function registerComponentDependencyPaths(appUrls: string[]): Promise<void> {
    const libs = await getManifestLibs(appUrls);
    if (libs && libs.length > 0) {
        let url = '/sap/bc/ui2/app_index/ui5_app_info?id=' + libs;
        const sapClient = UriParameters.fromQuery(window.location.search).get('sap-client');
        if (sapClient && sapClient.length === 3) {
            url = url + '&sap-client=' + sapClient;
        }
        const response = await fetch(url);
        registerModules(await response.json());
    }
}

/**
 * Register SAP fonts that are also registered in a productive Fiori launchpad.
 */
export function registerSAPFonts() {
    //Fiori Theme font family and URI
    const fioriTheme = {
        fontFamily: 'SAP-icons-TNT',
        fontURI: sap.ui.require.toUrl('sap/tnt/themes/base/fonts/')
    };
    //Registering to the icon pool
    IconPool.registerFont(fioriTheme);
    //SAP Business Suite Theme font family and URI
    const bSuiteTheme = {
        fontFamily: 'BusinessSuiteInAppSymbols',
        fontURI: sap.ui.require.toUrl('sap/ushell/themes/base/fonts/')
    };
    //Registering to the icon pool
    IconPool.registerFont(bSuiteTheme);
}

/**
 * Read the application title from the resource bundle and set it as document title.
 */
export function setI18nTitle() {
    const locale = sap.ui.getCore().getConfiguration().getLanguage();
    const resourceBundle = ResourceBundle.create({
        url: 'i18n/i18n.properties',
        locale
    }) as ResourceBundle;
    document.title = resourceBundle.getText('appTitle') ?? document.title;
}

/**
 * Apply additional configuration.
 *
 * @param params init parameters read from the script tag
 * @param params.appUrls JSON containing a string array of application urls
 * @param params.flex JSON containing the flex configuration
 * @returns promise
 */
export function configure({ appUrls, flex }: { appUrls?: string | null; flex?: string | null }): Promise<void> {
    // Register RTA if configured
    if (flex) {
        sap.ushell.Container.attachRendererCreatedEvent(async function () {
            const serviceInstance = await sap.ushell.Container.getServiceAsync<AppLifeCycle>('AppLifeCycle');
            serviceInstance.attachAppLoaded(event => {
                const oView = event.getParameter('componentInstance');
                sap.ui.require(['sap/ui/rta/api/startAdaptation'], function (startAdaptation: (opts: object) => void) {
                    const options = {
                        rootControl: oView,
                        validateAppVersion: false,
                        flexSettings: JSON.parse(flex)
                    };
                    startAdaptation(options);
                });
            });
        });
    }

    // Load custom library paths if configured
    if (appUrls) {
        return registerComponentDependencyPaths(JSON.parse(appUrls));
    } else {
        return Promise.resolve();
    }
}

/**
 * Initialize the FLP sandbox.
 */
export function init() {
    setI18nTitle();
    registerSAPFonts();
    sap.ushell.Container.createRenderer().placeAt('content');
}

const bootstrapConfig = document.getElementById('sap-ui-bootstrap');
if (bootstrapConfig) {
    configure({
        appUrls: bootstrapConfig.getAttribute('data-open-ux-preview-libs-manifests'),
        flex: bootstrapConfig.getAttribute('data-open-ux-preview-flex-settings')
    })
        .then(init)
        .catch(() => Log.error('Sandbox initialization failed.'));
}