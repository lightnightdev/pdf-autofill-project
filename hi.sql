Select#(lf)t.Name,#(lf)
    CASE#(lf)   -- Is Sharing Enabled    
        WHEN t.PayrollReportSharingEnabled = 1 THEN 'Yes'#(lf)     
        WHEN t.PayrollReportSharingEnabled = 0 THEN 'No'#(lf)   
        ELSE 'unknown' -- Optional, in case there are other values#(lf)    
    END AS PayrollReportSharingEnabled,#(lf)t.PayrollReportLockDay,#(lf)t.PayrollReportShareDay,#(lf)  
    CASE pr.[month]#(lf)  -- Rename months 
        WHEN 1 THEN 'January'#(lf)        
        WHEN 2 THEN 'February'#(lf)       
        WHEN 3 THEN 'March'#(lf)        
        WHEN 4 THEN 'April'#(lf)        
        WHEN 5 THEN 'May'#(lf)        
        WHEN 6 THEN 'June'#(lf)       
        WHEN 7 THEN 'July'#(lf)       
        WHEN 8 THEN 'August'#(lf)        
        WHEN 9 THEN 'September'#(lf)        
        WHEN 10 THEN 'October'#(lf)        
        WHEN 11 THEN 'November'#(lf)        
        WHEN 12 THEN 'December'#(lf)        
        ELSE 'Invalid Month'#(lf)   
    END AS MonthName,#(lf)pr.[Year],#(lf)    
    CASE pr.isshared#(lf)     -- Is Shared  
        WHEN 0 THEN 'No'#(lf)        
        WHEN 1 THEN 'Yes'#(lf)        
        ELSE 'Invalid Value'#(lf)    
    END AS IsShared,#(lf)    
    CASE#(lf)   -- Is Locked
        WHEN pr.islocked = 1 THEN 'Yes'#(lf)        
        WHEN pr.islocked = 0 THEN 'No'#(lf)        
        ELSE 'unknown' -- Optional, to handle unexpected values#(lf)    
    END AS IsLocked#(lf)From teams t#(lf)    
JOIN PayrollReports pr
    ON t.TeamId = pr.TeamId
    AND pr.[Year]=2025#(lf)
    WHERE#(lf)t.isarchived <> 1;