import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.query(
  "blue.rito.label.auto.getServiceStatus",
  {
    params: null,
    output: {
      type: "lex",
      schema: /*#__PURE__*/ v.object({
        /**
         * Jetstream lisner cursor. If this value is delay, may be upstream failer.
         */
        jetstreamCursor: /*#__PURE__*/ v.datetimeString(),
        /**
         * Queue cursor. If this balue is delay, may be this service failer.
         */
        queueCursor: /*#__PURE__*/ v.datetimeString(),
        /**
         * Auto Labering service version
         */
        version: /*#__PURE__*/ v.string(),
      }),
    },
  },
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface $params {}
export interface $output extends v.InferXRPCBodyInput<mainSchema["output"]> {}

declare module "@atcute/lexicons/ambient" {
  interface XRPCQueries {
    "blue.rito.label.auto.getServiceStatus": mainSchema;
  }
}
