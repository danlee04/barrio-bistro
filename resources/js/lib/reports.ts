import { http } from '@/lib/http';
import type { ReportSummary } from '@/types';

type Wrapped<T> = { data: T };

export async function fetchReportSummary(): Promise<ReportSummary> {
    const response = await http.get<Wrapped<ReportSummary>>(
        '/api/v1/admin/reports/summary',
    );

    return response.data;
}

/** Loader: everything the dashboard shows. */
export function reportsLoader(): Promise<ReportSummary> {
    return fetchReportSummary();
}
