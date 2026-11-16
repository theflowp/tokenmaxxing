import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { Table, Tabs } from "@lenso/ui";
import { Meter, MeterIndicator, MeterTrack } from "@ui-sdk/react/meter";
import type { UsageResponse } from "../api";
import { ProviderMark, agentColor, providerColor } from "../agents";
import { useI18n } from "../i18n";
import type { Metric } from "./DailyChart";

const x = stylex.create({
  table: { width: "100%", fontSize: 13.5 },
  num: { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  muted: { color: "var(--muted)" },
  rank: { width: 32, color: "var(--muted)" },
  // Lenso panels add margin and padding; keep the table flush with the header row.
  panel: { marginTop: 0, padding: 0 },
});

/** Thin share bar under a label, relative to the biggest row. Headless UI SDK meter. */
function ShareMeter({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  return (
    <Meter value={value} min={0} max={max || 1} className="share-meter" aria-label={label}>
      <MeterTrack className="share-track">
        <MeterIndicator className="share-indicator" style={{ background: color }} />
      </MeterTrack>
    </Meter>
  );
}

function ModelTable({ data, metric }: { data: UsageResponse; metric: Metric }) {
  const { t, f } = useI18n();
  const rows = [...data.models].sort((a, b) => b[metric] - a[metric]);
  const max = rows[0]?.[metric] ?? 0;
  const shareKey = metric === "cost" ? "costShare" : "tokenShare";

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label={t.byModel} xstyle={x.table}>
          <Table.Header>
            <Table.Column columnKey="rank" xstyle={x.rank}>
              #
            </Table.Column>
            <Table.Column columnKey="model">{t.model}</Table.Column>
            <Table.Column columnKey="cost" xstyle={x.num}>
              {t.cost}
            </Table.Column>
            <Table.Column columnKey="share" xstyle={x.num}>
              {t.share}
            </Table.Column>
            <Table.Column columnKey="tokens" xstyle={x.num}>
              {t.tokens}
            </Table.Column>
          </Table.Header>
          <Table.Body>
            {rows.map((m, i) => (
              <Table.Row key={m.model} itemKey={m.model} textValue={m.model}>
                <Table.Cell columnKey="rank" xstyle={[x.rank, x.muted]}>
                  {i + 1}
                </Table.Cell>
                <Table.Cell columnKey="model">
                  <div className="model-cell">
                    <span className="model-name">
                      <ProviderMark provider={m.provider} />
                      {m.model}
                    </span>
                    <ShareMeter
                      value={m[metric]}
                      max={max}
                      color={providerColor(m.provider)}
                      label={t.shareOf(m.model)}
                    />
                  </div>
                </Table.Cell>
                <Table.Cell columnKey="cost" xstyle={x.num}>
                  {f.money(m.cost)}
                </Table.Cell>
                <Table.Cell columnKey="share" xstyle={[x.num, x.muted]}>
                  {f.percent(m[shareKey])}
                </Table.Cell>
                <Table.Cell columnKey="tokens" xstyle={[x.num, x.muted]}>
                  {f.tokens(m.tokens)}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function DayTable({ data, metric }: { data: UsageResponse; metric: Metric }) {
  const { t, f } = useI18n();
  const rows = [...data.daily].filter((d) => d.tokens > 0).reverse();
  const max = Math.max(0, ...rows.map((d) => d[metric]));
  const total = metric === "cost" ? data.totals.cost : data.totals.tokens;
  const agents = data.agents;

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label={t.byDay} xstyle={x.table}>
          <Table.Header>
            <Table.Column columnKey="date">{t.day}</Table.Column>
            {agents.length > 1 &&
              agents.map((a) => (
                <Table.Column key={a.agent} columnKey={a.agent} xstyle={x.num}>
                  {a.label}
                </Table.Column>
              ))}
            <Table.Column columnKey="cost" xstyle={x.num}>
              {t.cost}
            </Table.Column>
            <Table.Column columnKey="share" xstyle={x.num}>
              {t.share}
            </Table.Column>
            <Table.Column columnKey="tokens" xstyle={x.num}>
              {t.tokens}
            </Table.Column>
          </Table.Header>
          <Table.Body>
            {rows.map((d) => (
              <Table.Row key={d.date} itemKey={d.date} textValue={d.date}>
                <Table.Cell columnKey="date">
                  <div className="model-cell">
                    <span className="model-name">{f.dateLong(d.date)}</span>
                    <ShareMeter
                      value={d[metric]}
                      max={max}
                      color="var(--c-claude)"
                      label={t.shareOf(f.dateLong(d.date))}
                    />
                  </div>
                </Table.Cell>
                {agents.length > 1 &&
                  agents.map((a, i) => (
                    <Table.Cell key={a.agent} columnKey={a.agent} xstyle={[x.num, x.muted]}>
                      {d.agents[a.agent]?.tokens ? (
                        <span className="agent-val">
                          <span className="dot" style={{ background: agentColor(a.agent, i) }} />
                          {metric === "cost" ? f.money(d.agents[a.agent].cost) : f.tokens(d.agents[a.agent].tokens)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </Table.Cell>
                  ))}
                <Table.Cell columnKey="cost" xstyle={x.num}>
                  {f.money(d.cost)}
                </Table.Cell>
                <Table.Cell columnKey="share" xstyle={[x.num, x.muted]}>
                  {f.percent(total ? d[metric] / total : 0)}
                </Table.Cell>
                <Table.Cell columnKey="tokens" xstyle={[x.num, x.muted]}>
                  {f.tokens(d.tokens)}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

export function Breakdown({ data, metric }: { data: UsageResponse; metric: Metric }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<string>("model");
  return (
    <section className="breakdown">
      <Tabs value={tab} onValueChange={(v) => v && setTab(String(v))} size="sm">
        <div className="breakdown-head">
          <h3 className="section-title">{t.breakdown}</h3>
          <Tabs.List aria-label={t.groupBy}>
            <Tabs.Indicator />
            <Tabs.Tab value="model">{t.model}</Tabs.Tab>
            <Tabs.Tab value="day">{t.day}</Tabs.Tab>
          </Tabs.List>
        </div>
        <Tabs.Panel value="model" xstyle={x.panel}>
          <ModelTable data={data} metric={metric} />
        </Tabs.Panel>
        <Tabs.Panel value="day" xstyle={x.panel}>
          <DayTable data={data} metric={metric} />
        </Tabs.Panel>
      </Tabs>
    </section>
  );
}
