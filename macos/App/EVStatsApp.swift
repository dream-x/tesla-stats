import SwiftUI
import WidgetKit

@main
struct EVStatsApp: App {
    var body: some Scene {
        WindowGroup("EV Stats") {
            ContentView().frame(minWidth: 380, minHeight: 260)
        }
        .windowResizability(.contentSize)
    }
}

struct ContentView: View {
    @State private var summary: Summary?
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("⚡ EV Stats").font(.title2.weight(.semibold))
            Text("Виджет: правый клик по рабочему столу → «Изменить виджеты» → EV Stats. Период меняется через «Изменить виджет».")
                .font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            Divider()
            if let s = summary {
                Text("\(s.vehicleName) · \(s.period.label): \(Fmt.num(s.km)) км, \(Fmt.num(s.kwh, 1)) кВт·ч")
                Text("Сервер доступен ✓").foregroundStyle(.green).font(.caption)
            } else if let e = error {
                Text(e).foregroundStyle(.red).font(.caption)
            } else {
                ProgressView()
            }
            Spacer()
            HStack {
                Button("Обновить виджеты") {
                    WidgetCenter.shared.reloadAllTimelines()
                    Task { await load() }
                }
                Button("Открыть дашборд") { NSWorkspace.shared.open(URL(string: AppConfig.baseURL)!) }
            }
        }
        .padding(20)
        .task { await load() }
    }

    private func load() async {
        do {
            summary = try await StatsAPI.fetch(period: "month")
            error = nil
        } catch {
            self.error = "Нет связи с \(AppConfig.baseURL): \(error.localizedDescription)"
        }
    }
}
