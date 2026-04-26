import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description } = await req.json();
    if (!description || typeof description !== "string" || description.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Please provide a longer description (at least a sentence or two)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service is not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = `You extract structured startup-idea fields from a founder's freeform description.

STRICT RULES:
- Be 100% faithful to what the founder wrote. NEVER invent, infer, or guess fields that are not explicitly present.
- If a field is not clearly stated in the description, return an EMPTY STRING for it. Do not fill it in.
- Do NOT extrapolate from one field into another (e.g. don't guess a target user from a problem statement).
- Keep each extracted field concise (one short sentence or phrase) and use the founder's own wording where possible.

FIELD GUIDE (only fill if explicitly present):
- startupName, pitch, industry (e.g. Healthcare, Fintech, SaaS), targetUser, problem, alternatives, businessModel, technical.

When in doubt, leave the field as an empty string. Empty is always safer than guessing.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: description },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_idea",
              description: "Return structured fields extracted from a startup idea description. Empty string for anything not explicitly present.",
              parameters: {
                type: "object",
                properties: {
                  startupName: { type: "string", description: "Product or company name, or empty string." },
                  pitch: { type: "string", description: "One-line summary of the product, or empty string." },
                  industry: { type: "string", description: "Industry (e.g. Healthcare, Fintech, SaaS), or empty string." },
                  targetUser: { type: "string", description: "Who specifically uses this, or empty string." },
                  problem: { type: "string", description: "The pain being solved, or empty string." },
                  alternatives: { type: "string", description: "What users do today instead, or empty string." },
                  businessModel: { type: "string", description: "Monetization, or empty string." },
                  technical: { type: "string", description: "Technical approach, or empty string." },
                },
                required: [
                  "startupName",
                  "pitch",
                  "industry",
                  "targetUser",
                  "problem",
                  "alternatives",
                  "businessModel",
                  "technical",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_idea" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached, please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI extraction failed." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({ error: "AI did not return structured output." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const args = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ idea: args }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-idea error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});