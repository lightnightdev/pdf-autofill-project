using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;

[ApiController]
[Route("api/[controller]")]
public class AutofillController : ControllerBase
{
    private readonly IConfiguration _config;

    public AutofillController(IConfiguration config)
    {
        _config = config;
    }

    private string ConnectionString => _config.GetConnectionString("DefaultConnection");

    // GET api/autofill/list
    [HttpGet("list")]
    public async Task<IActionResult> GetList()
    {
        var list = new List<object>();

        using var conn = new SqlConnection(ConnectionString);
        using var cmd = new SqlCommand(@"
            SELECT id, carrierName, pdfFileName, PdfFileSize, csvFileName, notes, createdUtc
            FROM dbo.autofillPdfData
            ORDER BY createdUtc DESC", conn);

        await conn.OpenAsync();
        using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            list.Add(new
            {
                Id = reader.GetInt32(0),
                CarrierName = reader.GetString(1),
                PdfFileName = reader.GetString(2),
                PdfFileSize = reader.GetInt32(3),
                CsvFileName = reader.GetString(4),
                Notes = reader.IsDBNull(5) ? null : reader.GetString(5),
                CreatedUtc = reader.GetDateTime(6)
            });
        }

        return Ok(list);
    }

    // GET api/autofill/data/{id}
    [HttpGet("data/{id}")]
    public async Task<IActionResult> GetData(int id)
    {
        using var conn = new SqlConnection(ConnectionString);
        using var cmd = new SqlCommand(@"
            SELECT pdfFileName, PdfBlob, csvFileName, csvMarkerData
            FROM dbo.autofillPdfData
            WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("@id", id);

        await conn.OpenAsync();
        using var reader = await cmd.ExecuteReaderAsync();

        if (!await reader.ReadAsync())
            return NotFound();

        return File(
            fileContents: (byte[])reader["PdfBlob"],
            contentType: "application/pdf",
            fileDownloadName: (string)reader["pdfFileName"]
        );
    }

    // POST api/autofill
    [HttpPost]
    [RequestSizeLimit(52428800)] // 50MB limit if needed
    public async Task<IActionResult> Create([FromForm] AutofillUploadRequest req)
    {
        if (req.PdfFile == null || req.PdfFile.Length == 0)
            return BadRequest("PDF file is required.");

        using var mem = new MemoryStream();
        await req.PdfFile.CopyToAsync(mem);
        var pdfBytes = mem.ToArray();

        using var conn = new SqlConnection(ConnectionString);
        using var cmd = new SqlCommand(@"
            INSERT INTO dbo.autofillPdfData
                (carrierName, pdfFileName, PdfFileSize, PdfBlob, csvFileName, csvMarkerData, notes)
            VALUES
                (@carrierName, @pdfFileName, @pdfFileSize, @PdfBlob, @csvFileName, @csvMarkerData, @notes);
            SELECT SCOPE_IDENTITY();", conn);

        cmd.Parameters.AddWithValue("@carrierName", req.CarrierName ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@pdfFileName", req.PdfFile.FileName);
        cmd.Parameters.AddWithValue("@pdfFileSize", req.PdfFile.Length);
        cmd.Parameters.Add("@PdfBlob", SqlDbType.VarBinary).Value = pdfBytes;
        cmd.Parameters.AddWithValue("@csvFileName", req.CsvFileName ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@csvMarkerData", req.CsvMarkerData ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@notes", (object?)req.Notes ?? DBNull.Value);

        await conn.OpenAsync();
        var newId = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        return Ok(new { id = newId });
    }

    // DELETE api/autofill/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        using var conn = new SqlConnection(ConnectionString);
        using var cmd = new SqlCommand("DELETE FROM dbo.autofillPdfData WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("@id", id);

        await conn.OpenAsync();
        var rows = await cmd.ExecuteNonQueryAsync();

        if (rows == 0) return NotFound();
        return NoContent();
    }
}

public class AutofillUploadRequest
{
    public string? CarrierName { get; set; }
    public string? CsvFileName { get; set; }
    public string? CsvMarkerData { get; set; }
    public string? Notes { get; set; }
    public IFormFile? PdfFile { get; set; }
}
