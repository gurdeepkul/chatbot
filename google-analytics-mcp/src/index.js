import dotenv from "dotenv";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

dotenv.config();

const propertyId = process.env.GA4_PROPERTY_ID || process.env.GA_PROPERTY_ID;

const analyticsDataClient = new BetaAnalyticsDataClient();

const mcpServer = new McpServer(
  {
    name: "google-analytics-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: { listChanged: true },
    },
  }
);

const buildProperty = (overrides) => {
  const id = overrides?.propertyId || propertyId;
  if (!id) {
    return undefined;
  }
  return `properties/${id}`;
};

const toToolTextContent = (obj) => ({
  content: [
    {
      type: "text",
      text: JSON.stringify(obj, null, 2),
    },
  ],
});

mcpServer.registerTool(
  "query_analytics",
  {
    description: "Run an arbitrary GA4 runReport request. Provide dimensions, metrics, dateRanges, filters, etc.",
    inputSchema: z.object({
      propertyId: z.string().optional().describe("GA4 property ID; defaults to GA4_PROPERTY_ID env var"),
      dateRanges: z
        .array(
          z.object({ startDate: z.string(), endDate: z.string() })
        )
        .nonempty(),
      dimensions: z.array(z.string()).optional(),
      metrics: z.array(z.string()).nonempty(),
      dimensionFilter: z.any().optional(),
      metricFilter: z.any().optional(),
      limit: z.number().int().positive().optional(),
      offset: z.number().int().nonnegative().optional(),
      orderBys: z.any().optional(),
    }),
  },
  async (args) => {
    const [response] = await analyticsDataClient.runReport({
      property: buildProperty(args),
      dateRanges: args.dateRanges,
      dimensions: (args.dimensions || []).map((name) => ({ name })),
      metrics: args.metrics.map((name) => ({ name })),
      dimensionFilter: args.dimensionFilter,
      metricFilter: args.metricFilter,
      limit: args.limit,
      offset: args.offset,
      orderBys: args.orderBys,
    });
    return toToolTextContent(response);
  }
);

mcpServer.registerTool(
  "get_realtime_data",
  {
    description: "Retrieve GA4 realtime metrics (activeUsers by country by default).",
    inputSchema: z.object({
      propertyId: z.string().optional(),
      dimensions: z.array(z.string()).default(["country"]).optional(),
      metrics: z.array(z.string()).default(["activeUsers"]).optional(),
    }),
  },
  async (args) => {
    const [response] = await analyticsDataClient.runRealtimeReport({
      property: buildProperty(args),
      dimensions: (args.dimensions || ["country"]).map((name) => ({ name })),
      metrics: (args.metrics || ["activeUsers"]).map((name) => ({ name })),
    });
    return toToolTextContent(response);
  }
);

mcpServer.registerTool(
  "get_traffic_sources",
  {
    description: "Traffic sources over a date range (source/medium, sessions).",
    inputSchema: z.object({
      propertyId: z.string().optional(),
      startDate: z.string().default("7daysAgo").optional(),
      endDate: z.string().default("today").optional(),
    }),
  },
  async ({ propertyId: overrideId, startDate = "7daysAgo", endDate = "today" }) => {
    const [response] = await analyticsDataClient.runReport({
      property: buildProperty({ propertyId: overrideId }),
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "source" }, { name: "medium" }],
      metrics: [{ name: "sessions" }],
    });
    return toToolTextContent(response);
  }
);

mcpServer.registerTool(
  "get_user_demographics",
  {
    description: "User demographics by country and city over a date range.",
    inputSchema: z.object({
      propertyId: z.string().optional(),
      startDate: z.string().default("7daysAgo").optional(),
      endDate: z.string().default("today").optional(),
    }),
  },
  async ({ propertyId: overrideId, startDate = "7daysAgo", endDate = "today" }) => {
    const [response] = await analyticsDataClient.runReport({
      property: buildProperty({ propertyId: overrideId }),
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "country" }, { name: "city" }],
      metrics: [{ name: "activeUsers" }],
    });
    return toToolTextContent(response);
  }
);

mcpServer.registerTool(
  "get_page_performance",
  {
    description: "Page performance metrics like views and avg session duration by pagePath.",
    inputSchema: z.object({
      propertyId: z.string().optional(),
      startDate: z.string().default("7daysAgo").optional(),
      endDate: z.string().default("today").optional(),
    }),
  },
  async ({ propertyId: overrideId, startDate = "7daysAgo", endDate = "today" }) => {
    const [response] = await analyticsDataClient.runReport({
      property: buildProperty({ propertyId: overrideId }),
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "averageSessionDuration" }],
    });
    return toToolTextContent(response);
  }
);

mcpServer.registerTool(
  "get_conversion_data",
  {
    description: "Conversion-related metrics by eventName over a date range.",
    inputSchema: z.object({
      propertyId: z.string().optional(),
      startDate: z.string().default("7daysAgo").optional(),
      endDate: z.string().default("today").optional(),
    }),
  },
  async ({ propertyId: overrideId, startDate = "7daysAgo", endDate = "today" }) => {
    const [response] = await analyticsDataClient.runReport({
      property: buildProperty({ propertyId: overrideId }),
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
    });
    return toToolTextContent(response);
  }
);

mcpServer.registerTool(
  "get_custom_report",
  {
    description: "Generate a custom GA4 report with chosen dimensions, metrics, and dateRanges.",
    inputSchema: z.object({
      propertyId: z.string().optional(),
      dimensions: z.array(z.string()).default([]).optional(),
      metrics: z.array(z.string()).nonempty(),
      dateRanges: z
        .array(z.object({ startDate: z.string(), endDate: z.string() }))
        .nonempty(),
      dimensionFilter: z.any().optional(),
      metricFilter: z.any().optional(),
      limit: z.number().int().positive().optional(),
      offset: z.number().int().nonnegative().optional(),
      orderBys: z.any().optional(),
    }),
  },
  async (args) => {
    const [response] = await analyticsDataClient.runReport({
      property: buildProperty(args),
      dateRanges: args.dateRanges,
      dimensions: (args.dimensions || []).map((name) => ({ name })),
      metrics: args.metrics.map((name) => ({ name })),
      dimensionFilter: args.dimensionFilter,
      metricFilter: args.metricFilter,
      limit: args.limit,
      offset: args.offset,
      orderBys: args.orderBys,
    });
    return toToolTextContent(response);
  }
);

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
