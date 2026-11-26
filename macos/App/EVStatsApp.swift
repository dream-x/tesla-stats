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
            Text(L10n.widgetHelp)
                .font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            Divider()
            if let s = summary {
                Text("\(s.vehicleName) · \(s.period.label): \(Fmt.num(s.km)) \(L10n.km), \(Fmt.num(s.kwh, 1)) \(L10n.kwh)")
                Text(L10n.serverReachable).foregroundStyle(.green).font(.caption)
            } else if let e = error {
                Text(e).foregroundStyle(.red).font(.caption)
            } else {
                ProgressView()
            }
            Spacer()
            HStack {
                Button(L10n.reloadWidgets) {
                    WidgetCenter.shared.reloadAllTimelines()
                    Task { await load() }
                }
                Button(L10n.openDashboard) { NSWorkspace.shared.open(URL(string: AppConfig.baseURL)!) }
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
            self.error = "\(L10n.noConnection(AppConfig.baseURL)): \(error.localizedDescription)"
        }
    }
}
