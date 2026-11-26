import Foundation

/// UI strings: Russian when the first preferred system language is Russian, English otherwise.
enum L10n {
    static let isRussian = Locale.preferredLanguages.first?.hasPrefix("ru") ?? false
    static let numberLocale = Locale(identifier: isRussian ? "ru_RU" : "en_US")

    private static func tr(_ en: String, _ ru: String) -> String { isRussian ? ru : en }

    static let km = tr("km", "км")
    static let kwh = tr("kWh", "кВт·ч")
    static let whPerKm = tr("Wh/km", "Вт·ч/км")
    static let kmToday = tr("km today", "км сегодня")
    static let kwhToday = tr("kWh today", "кВт·ч сегодня")
    static let charges = tr("charges", "зарядок")
    static let kmRange = tr("km range", "км запаса")
    static let noData = tr("No data", "Нет данных")
    static let startServer = tr("Start the server: npm start", "Запустите сервер: npm start")
    static let widgetDescription = tr("Mileage and charging over a period", "Пробег и зарядка за период")
    static let thisMonth = tr("This month", "Этот месяц")
    static let placeholderCurrency = tr("$", "₽")
    static let widgetHelp = tr(
        "Widget: right-click the desktop → “Edit Widgets” → EV Stats. Change the period via “Edit Widget”.",
        "Виджет: правый клик по рабочему столу → «Изменить виджеты» → EV Stats. Период меняется через «Изменить виджет»."
    )
    static let serverReachable = tr("Server reachable ✓", "Сервер доступен ✓")
    static let reloadWidgets = tr("Reload widgets", "Обновить виджеты")
    static let openDashboard = tr("Open dashboard", "Открыть дашборд")

    static func today(_ km: String) -> String { tr("today \(km) km", "сегодня \(km) км") }
    static func noConnection(_ url: String) -> String { tr("Can't reach \(url)", "Нет связи с \(url)") }
}
