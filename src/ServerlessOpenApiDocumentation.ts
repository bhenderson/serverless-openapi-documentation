import * as c from 'chalk';
import * as fs from 'fs';
import * as YAML from 'js-yaml';
import { DocumentGenerator } from './DocumentGenerator';
import { IConfigType } from './types';
import { merge } from './utils';

export class ServerlessOpenApiDocumentation {
  public hooks;
  public commands;
  /** Serverless Instance */
  private serverless;
  /** CLI options */
  private options;
  /** Serverless Service Custom vars */
  private customVars;

  /**
   * Constructor
   * @param serverless
   * @param options
   */
  constructor (serverless, options) {
    // pull the serverless instance into our class vars
    this.serverless = serverless;
    // pull the CLI options into our class vars
    this.options = options;
    // Serverless service custom variables
    this.customVars = this.serverless.variables.service.custom;

    // Declare the commands this plugin exposes for the Serverless CLI
    this.commands = {
      openapi: {
        commands: {
          generate: {
            lifecycleEvents: [
              'serverless',
            ],
            usage: 'Generate OpenAPI v3 Documentation',
            options: {
              output: {
                usage: 'Output file location [default: openapi.yml|json]',
                shortcut: 'o',
              },
              format: {
                usage: 'OpenAPI file format (yml|json) [default: yml]',
                shortcut: 'f',
              },
              indent: {
                usage: 'File indentation in spaces[default: 2]',
                shortcut: 'i',
              },
            },
          },
        },
      },
    };

    // Declare the hooks our plugin is interested in
    this.hooks = {
      'openapi:generate:serverless': this.generate.bind(this),
    };
  }

  /**
   * Processes CLI input by reading the input from serverless
   * @returns config IConfigType
   */
  private processCliInput (): IConfigType {
    const config: IConfigType = {
      format: 'yaml',
      file: 'openapi.yml',
      indent: 2,
    };

    config.indent = this.serverless.processedInput.options.indent || 2;
    config.format = this.serverless.processedInput.options.format || 'yaml';

    if (['yaml', 'json'].indexOf(config.format.toLowerCase()) < 0) {
      throw new Error('Invalid Output Format Specified - must be one of "yaml" or "json"');
    }

    config.file = this.serverless.processedInput.options.output ||
      ((config.format === 'yaml') ? 'openapi.yml' : 'openapi.json');

    process.stdout.write(
      `${c.bold.green('[OPTIONS]')} ` +
      `format: "${c.bold.red(config.format)}", ` +
      `output file: "${c.bold.red(config.file)}", ` +
      `indentation: "${c.bold.red(String(config.indent))}"\n\n`,
      );
    return config;
  }

  /**
   * Generates OpenAPI Documentation based on serverless configuration and functions
   */
  private generate () {
    process.stdout.write(c.bold.underline('OpenAPI v3 Documentation Generator\n\n'));
    // Instantiate DocumentGenerator
    const dg = new DocumentGenerator(this.customVars.documentation);

    // Map function configurations
    const funcConfigs = this.serverless.service.getAllFunctions().map((functionName) => {
      const func = this.serverless.service.getFunction(functionName);
      return merge({ _functionName: functionName }, func);
    });

    // Add Paths to OpenAPI Output from Function Configuration
    dg.addPathsFromFunctionConfig(funcConfigs);

    // Process CLI Input options
    const config = this.processCliInput();

    // Generate the resulting OpenAPI Object
    const outputObject = dg.generate();

    // Output the OpenAPI document to the correct format
    let outputContent = '';
    switch (config.format.toLowerCase()) {
    case 'json':
      outputContent = JSON.stringify(outputObject, null, config.indent);
      break;
    case 'yaml':
    default:
      outputContent = YAML.safeDump(outputObject, { indent: config.indent });
      break;
    }

    // Write to disk
    fs.writeFileSync(config.file, outputContent);
    process.stdout.write(`${ c.bold.green('[SUCCESS]') } Output file to "${c.bold.red(config.file)}"\n`);
  }
}