@Library('jenkins-shared-lib@main') _

pipeline {
    agent any

    environment {
        EMAIL_USER = credentials('EMAIL_USER')
        EMAIL_PASS = credentials('EMAIL_PASS')
    }

    options {
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '20'))
    }

    triggers {
        githubPush()
    }

    stages {
        stage('Parallel Jobs') {
            parallel {
                stage('CI Job') {
                    agent {
                        node {
                            label 'built-in'
                            customWorkspace 'workspace/resume-matcher-premain-ci'
                        }
                    }
                    stages {
                        // Invokes the shared library script
                        runCi()
                    }
                }
                
                // Add OWASP or other parallel jobs here or via similar library methods
            }
        }
    }
}
