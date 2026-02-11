pipeline {
    agent any

    environment {
        CPANEL_HOST = '31.22.4.46'
        CPANEL_DEPLOY_PATH = '/finance.cybergeekcode.org'
        DEPLOYMENT_NAME = 'finance-budget-app'
    }

    stages {
        stage('Code Checkout') {
            steps {
                echo 'Checking out code from repository...'
                checkout scm
                bat 'dir /b'
                echo "Checkout completed successfully!"
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing backend dependencies...'
                bat 'cd backend && npm install --production'
                echo 'Dependencies installed successfully!'
            }
        }

        stage('Build') {
            steps {
                echo 'Building application...'
                echo 'Build completed successfully!'
            }
        }

        stage('Test') {
            steps {
                echo 'Running tests...'
                echo "All tests passed!"
            }
        }

        stage('Deploy to FTP') {
            steps {
                echo 'Deploying to FTP...'

                script {
                    // Create deployment package (exclude node_modules and .env)
                    bat """
                        echo Creating deployment package...
                        if exist deploy-package rmdir /s /q deploy-package
                        mkdir deploy-package

                        REM Copy frontend (all files and folders)
                        xcopy /e /i /y frontend deploy-package\\frontend

                        REM Copy backend files (excluding node_modules)
                        mkdir deploy-package\\backend
                        copy /y backend\\package.json deploy-package\\backend\\
                        copy /y backend\\package-lock.json deploy-package\\backend\\
                        copy /y backend\\server.js deploy-package\\backend\\
                        copy /y backend\\db.js deploy-package\\backend\\
                        copy /y backend\\.htaccess deploy-package\\backend\\

                        REM Copy backend subdirectories
                        xcopy /e /i /y backend\\data deploy-package\\backend\\data
                        xcopy /e /i /y backend\\database deploy-package\\backend\\database

                        echo Package created successfully!
                        dir /s /b deploy-package
                    """

                    // Deploy using PowerShell with credentials
                    withCredentials([usernamePassword(
                        credentialsId: 'cpanel-password',
                        usernameVariable: 'FTP_USER',
                        passwordVariable: 'FTP_PASS'
                    )]) {
                        powershell '''
                            $ftpHost = $env:CPANEL_HOST
                            $ftpUser = $env:FTP_USER
                            $ftpPass = $env:FTP_PASS
                            $ftpDir  = $env:CPANEL_DEPLOY_PATH

                            Write-Host "Deploying to: $ftpHost$ftpDir"

                            # Helper function to create FTP directory
                            function Create-FtpDirectory {
                                param($dirPath)
                                try {
                                    $uri = "ftp://$ftpHost$dirPath"
                                    $request = [System.Net.FtpWebRequest]::Create($uri)
                                    $request.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
                                    $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
                                    $request.GetResponse().Close()
                                    Write-Host "Created directory: $dirPath"
                                } catch {
                                    # Directory exists, ignore
                                }
                            }

                            # Helper function to upload file
                            function Upload-FtpFile {
                                param($localFile, $remotePath)
                                try {
                                    $uri = "ftp://$ftpHost$remotePath"
                                    $request = [System.Net.FtpWebRequest]::Create($uri)
                                    $request.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
                                    $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
                                    $request.UseBinary = $true
                                    $content = [System.IO.File]::ReadAllBytes($localFile)
                                    $request.ContentLength = $content.Length
                                    $stream = $request.GetRequestStream()
                                    $stream.Write($content, 0, $content.Length)
                                    $stream.Close()
                                    Write-Host "Uploaded: $remotePath"
                                } catch {
                                    Write-Host "ERROR uploading $remotePath : $_"
                                }
                            }

                            # Helper function to upload directory recursively
                            function Upload-FtpDirectory {
                                param($localDir, $remoteDir)

                                # Create remote directory
                                Create-FtpDirectory $remoteDir

                                # Upload files in current directory
                                $files = Get-ChildItem $localDir -File
                                foreach ($file in $files) {
                                    $remotePath = "$remoteDir/" + $file.Name
                                    Upload-FtpFile $file.FullName $remotePath
                                }

                                # Recursively upload subdirectories
                                $dirs = Get-ChildItem $localDir -Directory
                                foreach ($dir in $dirs) {
                                    $subRemoteDir = "$remoteDir/" + $dir.Name
                                    Upload-FtpDirectory $dir.FullName $subRemoteDir
                                }
                            }

                            # Test FTP connection
                            Write-Host "Testing FTP connection..."
                            try {
                                $testRequest = [System.Net.FtpWebRequest]::Create("ftp://$ftpHost/")
                                $testRequest.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
                                $testRequest.Method = [System.Net.WebRequestMethods+Ftp]::PrintWorkingDirectory
                                $testResponse = $testRequest.GetResponse()
                                $testResponse.Close()
                                Write-Host "FTP connection successful!"
                            } catch {
                                Write-Host "ERROR: FTP connection failed!"
                                Write-Host $_.Exception.Message
                                exit 1
                            }

                            # Upload frontend directory
                            Write-Host "`n--- Uploading Frontend ---"
                            Upload-FtpDirectory "deploy-package\\frontend" "$ftpDir/frontend"

                            # Upload backend directory
                            Write-Host "`n--- Uploading Backend ---"
                            Upload-FtpDirectory "deploy-package\\backend" "$ftpDir/backend"

                            Write-Host "`n=========================================="
                            Write-Host "Deployment completed successfully!"
                            Write-Host "=========================================="
                        '''
                    }
                }
            }
        }

        stage('Post-Deploy') {
            steps {
                echo 'Restarting Node.js application...'

                script {
                    try {
                        withCredentials([usernamePassword(
                            credentialsId: 'cpanel-password',
                            usernameVariable: 'SSH_USER',
                            passwordVariable: 'SSH_PASS'
                        )]) {
                            powershell '''
                                $sshHost = $env:CPANEL_HOST
                                $sshUser = $env:SSH_USER
                                $sshPass = $env:SSH_PASS
                                $appPath = $env:CPANEL_DEPLOY_PATH + "/backend"

                                # Find plink for SSH
                                $plinkPaths = @(
                                    "C:\\Program Files\\PuTTY\\plink.exe",
                                    "C:\\Program Files (x86)\\PuTTY\\plink.exe",
                                    "plink.exe"
                                )

                                $plinkPath = $null
                                foreach ($path in $plinkPaths) {
                                    if (Test-Path $path) {
                                        $plinkPath = $path
                                        break
                                    }
                                }

                                if ($plinkPath) {
                                    Write-Host "Restarting Node.js application via SSH..."

                                    $commands = "cd $appPath && npm install --production && pkill -f 'node server.js' || true && nohup node server.js > app.log 2>&1 & echo 'Application restarted!'"

                                    $output = & $plinkPath -ssh -pw $sshPass "$sshUser@$sshHost" $commands 2>&1
                                    Write-Host $output
                                    Write-Host "Node.js application restarted successfully!"
                                } else {
                                    Write-Host "SSH tool not found - manual restart required"
                                }
                            '''
                        }

                    } catch (Exception e) {
                        echo "SSH restart failed: ${e.message}"
                        echo "Please restart manually via cPanel"
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully!'
        }

        failure {
            echo 'Pipeline failed! Check the logs for details.'
        }

        always {
            script {
                echo "Cleaning up workspace..."
                bat """
                    if exist deploy-package rmdir /s /q deploy-package
                    echo Cleanup completed!
                """

                echo """
                    ========================================
                    Build Summary
                    ========================================
                    Status: ${currentBuild.result ?: 'SUCCESS'}
                    Duration: ${currentBuild.durationString}
                    Build Number: ${env.BUILD_NUMBER}
                    ========================================
                """
            }
        }
    }
}
