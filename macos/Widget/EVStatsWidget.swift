import AppIntents
import SwiftUI
import WidgetKit

enum StatsPeriod: String, AppEnum {
    case today, sevenDays = "7d", month, prevMonth = "prev-month", thirtyDays = "30d", year

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Период"
    static let caseDisplayRepresentations: [StatsPeriod: DisplayRepresentation] = [
        .today: "Сегодня", .sevenDays: "7 дней", .month: "Этот месяц",
        .prevMonth: "Прошлый месяц", .thirtyDays: "30 дней", .year: "Этот год",
    ]
}

struct PeriodIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Период статистики"
    static let description = IntentDescription("За какой период показывать пробег и зарядку.")

    @Parameter(title: "Период", default: .month)
    var period: StatsPeriod
}

struct StatsEntry: TimelineEntry {
    let date: Date
    let summary: Summary?
    let error: String?
}

struct Provider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> StatsEntry {
        StatsEntry(date: .now, summary: .placeholder, error: nil)
    }

    func snapshot(for configuration: PeriodIntent, in context: Context) async -> StatsEntry {
        if context.isPreview { return placeholder(in: context) }
        return await load(configuration)
    }

    func timeline(for configuration: PeriodIntent, in context: Context) async -> Timeline<StatsEntry> {
        let entry = await load(configuration)
        return Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(15 * 60)))
    }

    private func load(_ configuration: PeriodIntent) async -> StatsEntry {
        do {
            return StatsEntry(date: .now, summary: try await StatsAPI.fetch(period: configuration.period.rawValue), error: nil)
        } catch {
            return StatsEntry(date: .now, summary: nil, error: "Нет связи с \(AppConfig.baseURL)")
        }
    }
}

private let kmColor = Color(red: 0.22, green: 0.74, blue: 0.97)
private let kwhColor = Color(red: 0.20, green: 0.83, blue: 0.60)

struct BigStat: View {
    let value: String
    let unit: String
    let color: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(value).font(.system(size: 30, weight: .semibold, design: .rounded)).foregroundStyle(color)
                .minimumScaleFactor(0.5).lineLimit(1)
            Text(unit).font(.caption2).foregroundStyle(.secondary)
        }
    }
}

struct SmallStat: View {
    let value: String
    let label: String
    var body: some View {
        VStack(spacing: 1) {
            Text(value).font(.system(.callout, design: .rounded).weight(.medium)).lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(.system(size: 9)).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity)
    }
}

struct Bars: View {
    let series: [Summary.Point]
    var body: some View {
        let maxKm = max(1, series.map(\.km).max() ?? 1)
        let maxKwh = max(1, series.map(\.kwh).max() ?? 1)
        GeometryReader { geo in
            HStack(alignment: .bottom, spacing: 1.5) {
                ForEach(series, id: \.key) { p in
                    HStack(alignment: .bottom, spacing: 0.5) {
                        RoundedRectangle(cornerRadius: 1).fill(kmColor.opacity(0.85))
                            .frame(height: max(p.km > 0 ? 2 : 0, geo.size.height * p.km / maxKm))
                        RoundedRectangle(cornerRadius: 1).fill(kwhColor.opacity(0.85))
                            .frame(height: max(p.kwh > 0 ? 2 : 0, geo.size.height * p.kwh / maxKwh))
                    }
                }
            }.frame(maxHeight: .infinity, alignment: .bottom)
        }
    }
}

struct EVStatsWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: StatsEntry

    var body: some View {
        Group {
            if let s = entry.summary {
                content(s)
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    Text("⚡ EV Stats").font(.headline)
                    Text(entry.error ?? "Нет данных").font(.caption).foregroundStyle(.red)
                    Text("Запустите сервер: npm start").font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
        .containerBackground(for: .widget) { Color(red: 0.04, green: 0.04, blue: 0.05) }
        .widgetURL(URL(string: AppConfig.baseURL))
    }

    @ViewBuilder
    private func content(_ s: Summary) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("⚡ \(s.vehicleName)").font(.caption.weight(.semibold)).lineLimit(1)
                Spacer()
                if let b = s.latest?.batteryLevel {
                    Text("\(b)%").font(.caption).foregroundStyle(.secondary)
                }
            }
            Text(s.period.label.uppercased()).font(.system(size: 9)).foregroundStyle(.secondary)

            HStack(alignment: .top) {
                BigStat(value: Fmt.num(s.km), unit: "км", color: kmColor)
                Spacer(minLength: 8)
                BigStat(value: Fmt.num(s.kwh), unit: "кВт·ч", color: kwhColor)
                if family != .systemSmall {
                    Spacer(minLength: 8)
                    BigStat(value: s.whPerKm.map { Fmt.num($0) } ?? "—", unit: "Вт·ч/км", color: .white)
                    if s.cost > 0 {
                        Spacer(minLength: 8)
                        BigStat(value: Fmt.num(s.cost), unit: s.currency, color: .white)
                    }
                }
            }

            if family == .systemLarge {
                Bars(series: s.series).frame(maxHeight: .infinity)
            } else {
                Spacer(minLength: 0)
            }

            if family == .systemSmall {
                Text("сегодня \(Fmt.num(s.today.km)) км").font(.system(size: 9)).foregroundStyle(.secondary)
            } else {
                HStack {
                    SmallStat(value: Fmt.num(s.today.km), label: "км сегодня")
                    SmallStat(value: Fmt.num(s.today.kwh, 1), label: "кВт·ч сегодня")
                    SmallStat(value: "\(s.chargeCount)", label: "зарядок")
                    if let r = s.latest?.rangeKm { SmallStat(value: Fmt.num(r), label: "км запаса") }
                }
            }
        }
    }
}

@main
struct EVStatsWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "EVStatsWidget", intent: PeriodIntent.self, provider: Provider()) { entry in
            EVStatsWidgetView(entry: entry)
        }
        .configurationDisplayName("EV Stats")
        .description("Пробег и зарядка за период")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
