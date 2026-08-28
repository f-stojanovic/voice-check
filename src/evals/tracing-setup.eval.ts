/**
 * Turning tracing on. The only file that touches the OpenTelemetry SDK.
 *
 * OFF BY DEFAULT, ON BY `--trace`. A default-on exporter that silently fails to
 * connect is a worse state than no tracing: the run looks instrumented, nothing
 * arrives, and the person reading the waterfall concludes the code is not
 * traced rather than that the collector is not running.
 *
 * NOTHING HERE NEEDS AN ACCOUNT OR A KEY. OTLP over HTTP to a Jaeger you run
 * yourself, and a console exporter when nothing is listening. Same rule the
 * eval suite follows and the same reason: a demonstration that requires a third
 * party to be reachable is not a demonstration.
 *
 * `*.eval.ts`, so `tsconfig.build.json` keeps it out of `dist/` along with the
 * rest of `src/evals/` — the SDK and the exporter are devDependencies and must
 * not be reachable from the deployed service.
 */

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

/** Jaeger's OTLP/HTTP trace endpoint on a default local install. */
const DEFAULT_ENDPOINT = 'http://localhost:4318/v1/traces';

export interface TracingHandle {
  /** Flushes and shuts down. Must be awaited, or the last spans never leave. */
  shutdown: () => Promise<void>;
  endpoint: string;
}

/**
 * Registers a provider so the no-op API starts recording.
 *
 * `console` sends spans to stdout instead of the network, for when no collector
 * is running. It is deliberately a separate mode rather than a fallback: a
 * silent fallback would hide exactly the misconfiguration this file exists to
 * make loud.
 */
export function startTracing(options: { console?: boolean; endpoint?: string } = {}): TracingHandle {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'voice-check',
      [ATTR_SERVICE_VERSION]: '0.1.0',
    }),
    spanProcessors: options.console === true
      ? [new SimpleSpanProcessor(new ConsoleSpanExporter())]
      : [new BatchSpanProcessor(new OTLPTraceExporter({ url: endpoint }))],
  });

  provider.register();

  return {
    endpoint: options.console === true ? 'console' : endpoint,
    shutdown: async () => {
      /* A BatchSpanProcessor holds spans until a timer fires. A run that exits
         without this loses the last batch, which on a one-case eval is every
         span it produced. */
      await provider.forceFlush();
      await provider.shutdown();
    },
  };
}
