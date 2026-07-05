import { useMemo } from "react";
import { Box, Typography } from "@mui/material";

export interface PieSlice {
    label: string;
    value: number;
    color: string;
}

interface Props {
    slices: PieSlice[];
    /** Outer radius as fraction of the 100×100 viewBox (0-50). Default: 44 */
    radius?: number;
    /** Inner radius for donut style (0-50). Default: 0 = solid pie */
    innerRadius?: number;
    /** Gap between slices in degrees */
    gap?: number;
    size?: number;
    className?: string;
    /** Optional label to override the center donut total (e.g. "$3,155,976.54") */
    centerLabel?: string;
}

const DEG_TO_RAD = Math.PI / 180;

/** Describe an SVG arc path */
const arcPath = (
    cx: number,
    cy: number,
    r: number,
    startAngle: number,
    endAngle: number,
): string => {
    const x1 = cx + r * Math.cos(startAngle * DEG_TO_RAD);
    const y1 = cy + r * Math.sin(startAngle * DEG_TO_RAD);
    const x2 = cx + r * Math.cos(endAngle * DEG_TO_RAD);
    const y2 = cy + r * Math.sin(endAngle * DEG_TO_RAD);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
};

/** Describe a donut (ring) slice path */
const donutPath = (
    cx: number,
    cy: number,
    outerR: number,
    innerR: number,
    startAngle: number,
    endAngle: number,
): string => {
    const x1o = cx + outerR * Math.cos(startAngle * DEG_TO_RAD);
    const y1o = cy + outerR * Math.sin(startAngle * DEG_TO_RAD);
    const x2o = cx + outerR * Math.cos(endAngle * DEG_TO_RAD);
    const y2o = cy + outerR * Math.sin(endAngle * DEG_TO_RAD);

    const x1i = cx + innerR * Math.cos(startAngle * DEG_TO_RAD);
    const y1i = cy + innerR * Math.sin(startAngle * DEG_TO_RAD);
    const x2i = cx + innerR * Math.cos(endAngle * DEG_TO_RAD);
    const y2i = cy + innerR * Math.sin(endAngle * DEG_TO_RAD);

    const large = endAngle - startAngle > 180 ? 1 : 0;

    return [
        `M ${x1o} ${y1o}`,
        `A ${outerR} ${outerR} 0 ${large} 1 ${x2o} ${y2o}`,
        `L ${x2i} ${y2i}`,
        `A ${innerR} ${innerR} 0 ${large} 0 ${x1i} ${y1i}`,
        "Z",
    ].join(" ");
};

export const PieChart = ({
    slices,
    radius = 44,
    innerRadius = 0,
    gap = 1.5,
    size = 200,
    className,
    centerLabel,
}: Props) => {
    const total = useMemo(() => slices.reduce((s, sl) => s + sl.value, 0), [slices]);

    const cx = 50;
    const cy = 50;

    const paths = useMemo(() => {
        if (total === 0) return [];
        let cumAngle = -90; // start from top (12 o'clock)

        return slices.map((slice) => {
            const sliceAngle = (slice.value / total) * 360;
            const angleWithGap = Math.max(sliceAngle - gap, 0.5);
            const start = cumAngle;
            const end = cumAngle + angleWithGap;
            cumAngle += sliceAngle;

            const d = innerRadius > 0
                ? donutPath(cx, cy, radius, innerRadius, start, end)
                : arcPath(cx, cy, radius, start, end);

            return { d, color: slice.color, key: slice.label + start };
        });
    }, [slices, total, radius, innerRadius, gap]);

    if (total === 0) {
        return (
            <Box className={`flex items-center justify-center ${className ?? ""}`}>
                <Typography variant="body2" color="text.secondary">Sin datos</Typography>
            </Box>
        );
    }

    // Center label: use user-supplied string, or fallback to raw total
    const centerText = centerLabel ?? total.toLocaleString("es-AR");

    return (
        <svg
            viewBox="0 0 100 100"
            width={size}
            height={size}
            className={className}
            role="img"
            aria-label="Gráfico de torta"
        >
            {paths.map((p) => (
                <path key={p.key} d={p.d} fill={p.color} stroke="#fff" strokeWidth="0.5" />
            ))}
            {/* Center label for donut */}
            {innerRadius > 0 && (
                <>
                    <text
                        x={cx}
                        y={cy - 3}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-gray-500"
                        style={{ fontSize: "5px", fontFamily: "Inter, sans-serif" }}
                    >
                        Total
                    </text>
                    <text
                        x={cx}
                        y={cy + 4}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-gray-700 font-bold"
                        style={{ fontSize: "5.5px", fontFamily: "Inter, sans-serif" }}
                    >
                        {centerText}
                    </text>
                </>
            )}
        </svg>
    );
};

export default PieChart;
