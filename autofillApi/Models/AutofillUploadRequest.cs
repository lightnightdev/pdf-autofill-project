public class AutofillUploadRequest
{
    public string? CarrierName { get; set; }
    public string? CsvFileName { get; set; }
    public string? PdfFileName { get; set; }
    public string? CsvMarkerData { get; set; }
    public string? Notes { get; set; }
    public IFormFile? PdfFile { get; set; }
}
