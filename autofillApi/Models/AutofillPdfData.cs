namespace AutofillApi.Models
{
    public class AutofillPdfData
    {
        public int Id { get; set; }
        public string CarrierName { get; set; } = string.Empty;
        public string PdfFileName { get; set; } = string.Empty;
        public int PdfFileSize { get; set; }
        public byte[] PdfBlob { get; set; } = Array.Empty<byte>();
        public string CsvFileName { get; set; } = string.Empty;
        public string CsvMarkerData { get; set; } = string.Empty;
        public string? Notes { get; set; }
        public DateTime CreatedUtc { get; set; }
    }

}
