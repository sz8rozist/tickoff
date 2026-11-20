package io.tickoff.project;

import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Egyszerű CSV-író magyar Excelhez: pontosvessző elválasztó, UTF-8 BOM (különben az ékezetek elromlanak),
 * CRLF sorvég. A cellák védettek a CSV-injection ellen: az "=", "+", "-", "@" jellel kezdődő szöveget
 * Excel képletként értelmezné, ezért aposztróf kerül elé.
 */
public final class CsvWriter {

    private static final char SEPARATOR = ';';
    private static final String NEWLINE = "\r\n";
    private static final byte[] BOM = {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};

    private final StringBuilder out = new StringBuilder();

    public CsvWriter row(List<String> cells) {
        for (int i = 0; i < cells.size(); i++) {
            if (i > 0) out.append(SEPARATOR);
            out.append(cell(cells.get(i)));
        }
        out.append(NEWLINE);
        return this;
    }

    public byte[] toBytes() {
        byte[] body = out.toString().getBytes(StandardCharsets.UTF_8);
        byte[] result = new byte[BOM.length + body.length];
        System.arraycopy(BOM, 0, result, 0, BOM.length);
        System.arraycopy(body, 0, result, BOM.length, body.length);
        return result;
    }

    static String cell(String value) {
        if (value == null || value.isEmpty()) return "";
        String v = value;
        char first = v.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r') {
            v = "'" + v;
        }
        boolean needsQuotes = v.indexOf(SEPARATOR) >= 0 || v.indexOf('"') >= 0 || v.indexOf('\n') >= 0 || v.indexOf('\r') >= 0;
        return needsQuotes ? "\"" + v.replace("\"", "\"\"") + "\"" : v;
    }
}
