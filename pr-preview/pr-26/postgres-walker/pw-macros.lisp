(defmacro qp (query-form)
  "Query returning plists (for processing)"
  `(query ,query-form :plists))

(defmacro qa (query-form)
  "Query returning alists"
  `(query ,query-form :alists))

(defmacro q1 (query-form)
  "Query returning single plist"
  `(query ,query-form :plist))

(defmacro qc (query-form)
  "Query returning column"
  `(query ,query-form :column))

(defmacro qv (query-form)
  "Query returning single value"
  `(query ,query-form :single))

;; Usage:
(qp (:select 'name 'email :from 'users))  ; => plists
(q1 (:select '* :from 'users :where (:= 'id 5)))  ; => single plist
(qc (:select 'email :from 'users))  ; => list of emails
(qv (:select (:count '*) :from 'users))  ; => 42
