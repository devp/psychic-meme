;; Pretty display (default)
(q (:select 'name 'email :from 'users))

;; Get data for processing (as plists - most convenient)
(let ((users (q (:select 'name 'email 'created-at :from 'users) :format :raw)))
  (loop for user in users
        when (string= (getf user :name) "Alice")
        collect (getf user :email)))

;; Get just emails as a list
(q (:select 'email :from 'users) :format :raw :result-format :column)
;; => ("alice@example.com" "bob@example.com" ...)

;; Get count as single value
(q (:select (:count '*) :from 'users) :format :raw :result-format :single)
;; => 42

;; Get one user as plist
(q (:select '* :from 'users :where (:= 'id 5)) :format :raw :result-format :plist)
;; => (:ID 5 :NAME "Alice" :EMAIL "alice@example.com" :CREATED-AT ...)
