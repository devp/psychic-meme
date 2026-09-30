;; sbcl --load init-postmodern.example.lisp
(load "~/quicklisp/setup.lisp")
(ql:quickload :postmodern)
(use-package :postmodern)
(defun connect-local ()
  (connect-toplevel 'DATABASE-NAME 'USER-NAME 'PASSWORD 'HOST))
