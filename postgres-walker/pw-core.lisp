(defun q (query-form &key (format :pretty) (result-format :plists))
  "Execute query with flexible result formats
   
   :format - :pretty for formatted output, :raw for data
   :result-format - :plists, :alists, :rows, :plist, :alist, :row, :column, :single
   
   Examples:
     (q (:select '* :from users))  ; pretty printed
     (q (:select '* :from users) :format :raw)  ; returns plists
     (q (:select '* :from users) :format :raw :result-format :alists)
     (q (:select 'email :from users) :format :raw :result-format :column)
   "
  (let ((results (query query-form result-format)))
    (if (eq format :pretty)
        (pretty-print-results results result-format)
        results)))

(defun pretty-print-results (results result-format)
  "Pretty print results based on format"
  (cond
    ((member result-format '(:plists :alists))
     (when results
       (let* ((first-row (first results))
              (columns (if (eq result-format :plists)
                          (loop for (key value) on first-row by #'cddr collect key)
                          (mapcar #'car first-row))))
         (print-table columns results result-format))))
    
    ((eq result-format :column)
     (format t "~{~A~%~}" results)
     results)
    
    ((eq result-format :single)
     (format t "~A~%" results)
     results)
    
    (t ; :rows, :row, etc
     (format t "~{~{~A~^ | ~}~%~}" 
             (if (listp (first results)) results (list results)))
     results)))

(defun print-table (columns rows format-type)
  "Print rows as a formatted table"
  (let ((col-widths (mapcar (lambda (col)
                             (max (length (string col))
                                  (reduce #'max rows
                                          :key (lambda (row)
                                                (length (format nil "~A" 
                                                               (if (eq format-type :plists)
                                                                   (getf row col)
                                                                   (cdr (assoc col row)))))))))
                           columns)))
    ;; Headers
    (format t "~%")
    (loop for col in columns
          for width in col-widths
          do (format t "~VA | " width col))
    (format t "~%")
    
    ;; Separator
    (loop for width in col-widths
          do (format t "~V@{~A~:*~} | " (+ width 1) "-"))
    (format t "~%")
    
    ;; Rows
    (dolist (row rows)
      (loop for col in columns
            for width in col-widths
            for value = (if (eq format-type :plists)
                           (getf row col)
                           (cdr (assoc col row)))
            do (format t "~VA | " width (if value value "NULL")))
      (format t "~%"))
    
    (format t "~%(~D row~:P)~%" (length rows))
    rows))
