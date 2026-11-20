package io.tickoff.project;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CsvWriterTest {

    @Test
    void plainCellsAreLeftAlone() {
        assertThat(CsvWriter.cell("Kávézó weboldal")).isEqualTo("Kávézó weboldal");
        assertThat(CsvWriter.cell("")).isEmpty();
        assertThat(CsvWriter.cell(null)).isEmpty();
    }

    @Test
    void separatorQuotesAndNewlinesAreQuoted() {
        assertThat(CsvWriter.cell("egy; kettő")).isEqualTo("\"egy; kettő\"");
        assertThat(CsvWriter.cell("mondta: \"szia\"")).isEqualTo("\"mondta: \"\"szia\"\"\"");
        assertThat(CsvWriter.cell("első sor\nmásodik sor")).isEqualTo("\"első sor\nmásodik sor\"");
        assertThat(CsvWriter.cell("első\r\nmásodik")).isEqualTo("\"első\r\nmásodik\"");
    }

    @Test
    void formulaStartsAreNeutralizedAgainstCsvInjection() {
        for (String dangerous : Arrays.asList("=SUM(A1:A9)", "+36 1 234", "-2+3", "@parancs", "\tfül")) {
            assertThat(CsvWriter.cell(dangerous)).as(dangerous).startsWith("'");
        }
        // A közepén álló jel nem veszélyes
        assertThat(CsvWriter.cell("a=b")).isEqualTo("a=b");
    }

    @Test
    void injectedCellThatAlsoNeedsQuotingIsBothPrefixedAndQuoted() {
        assertThat(CsvWriter.cell("=HYPERLINK(\"http://x\";\"y\")")).isEqualTo("\"'=HYPERLINK(\"\"http://x\"\";\"\"y\"\")\"");
    }

    @Test
    void outputStartsWithUtf8BomAndUsesSemicolonAndCrlf() {
        byte[] bytes = new CsvWriter().row(List.of("Kör", "Szerző")).row(List.of("1", "Ügyfél Anna")).toBytes();

        assertThat(Arrays.copyOf(bytes, 3)).containsExactly((byte) 0xEF, (byte) 0xBB, (byte) 0xBF);
        String text = new String(bytes, 3, bytes.length - 3, StandardCharsets.UTF_8);
        assertThat(text).isEqualTo("Kör;Szerző\r\n1;Ügyfél Anna\r\n");
    }

    @Test
    void slugIsAsciiAndFileNameSafe() {
        assertThat(CommentController.slug("Kávézó Árvíztűrő Tükörfúrógép!")).isEqualTo("kavezo-arvizturo-tukorfurogep");
        assertThat(CommentController.slug("  ../../etc/passwd  ")).isEqualTo("etc-passwd");
        assertThat(CommentController.slug("!!!")).isEqualTo("projekt");
        assertThat(CommentController.slug("a".repeat(100))).hasSizeLessThanOrEqualTo(40);
    }
}
