import Foundation

struct Summary: Codable {
    struct Period: Codable { let key: String; let label: String }
    struct Today: Codable { let km: Double; let kwh: Double }
    struct Latest: Codable {
        let ts: Double
        let odometerKm: Double
        let batteryLevel: Int?
        let rangeKm: Double?
        let chargingState: String?
    }
    struct Point: Codable { let key: String; let label: String; let km: Double; let kwh: Double }

    let vehicleName: String
    let period: Period
    let km: Double
    let kwh: Double
    let whPerKm: Double?
    let cost: Double
    let currency: String
    let chargeCount: Int
    let today: Today
    let latest: Latest?
    let series: [Point]

    static let placeholder = Summary(
        vehicleName: "Tesla",
        period: .init(key: "month", label: L10n.thisMonth),
        km: 1333, kwh: 234, whPerKm: 176, cost: 1180, currency: L10n.placeholderCurrency, chargeCount: 9,
        today: .init(km: 32, kwh: 0),
        latest: .init(ts: Date().timeIntervalSince1970 * 1000, odometerKm: 80490, batteryLevel: 65, rangeKm: 282, chargingState: "Disconnected"),
        series: (1...25).map { .init(key: "\($0)", label: "\($0)", km: Double(($0 * 37) % 90), kwh: Double(($0 * 53) % 40)) }
    )
}

enum StatsAPI {
    static func summaryURL(period: String) -> URL {
        var c = URLComponents(string: AppConfig.baseURL + "/api/summary")!
        c.queryItems = [URLQueryItem(name: "period", value: period)]
        if !AppConfig.token.isEmpty { c.queryItems?.append(URLQueryItem(name: "token", value: AppConfig.token)) }
        return c.url!
    }

    static func fetch(period: String) async throws -> Summary {
        var req = URLRequest(url: summaryURL(period: period), timeoutInterval: 15)
        req.cachePolicy = .reloadIgnoringLocalCacheData
        let (data, resp) = try await URLSession.shared.data(for: req)
        if let http = resp as? HTTPURLResponse, http.statusCode != 200 {
            throw URLError(.init(rawValue: http.statusCode))
        }
        return try JSONDecoder().decode(Summary.self, from: data)
    }
}

enum Fmt {
    static func num(_ v: Double, _ digits: Int = 0) -> String {
        let f = NumberFormatter()
        f.locale = L10n.numberLocale
        f.numberStyle = .decimal
        f.maximumFractionDigits = digits
        return f.string(from: NSNumber(value: v)) ?? "\(v)"
    }
}
